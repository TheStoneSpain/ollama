import { useEffect, useRef, useState, type JSX } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { pullModel } from "@/api";
import {
  formatBytes,
  formatCount,
  getHuggingFaceQuants,
  normalizeHuggingFaceRef,
  searchHuggingFaceModels,
  type HuggingFaceQuant,
  type HuggingFaceResult,
} from "@/lib/huggingface";

const URL_PREFIX = /^(?:https?:\/\/)?(?:www\.)?(?:huggingface\.co|hf\.co)\//i;

export function HuggingFacePull({
  onPulled,
}: {
  onPulled: (model: string) => void;
}): JSX.Element {
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const [results, setResults] = useState<HuggingFaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [repo, setRepo] = useState<string | null>(null);
  const [quants, setQuants] = useState<HuggingFaceQuant[]>([]);
  const [loadingQuants, setLoadingQuants] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pulling, setPulling] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // "org/repo:quant" is pulled as typed; anything else is searched.
  const exactRef = normalizeHuggingFaceRef(value);
  const hasQuant = !!exactRef && exactRef.includes(":");
  const repoGuess =
    exactRef && !hasQuant ? exactRef.replace(/^hf\.co\//, "") : null;
  const searchText = value.trim().replace(URL_PREFIX, "");

  useEffect(() => {
    setResults([]);
    if (repo || hasQuant || searchText.length < 2) {
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        setResults(
          await searchHuggingFaceModels(searchText, controller.signal),
        );
        setError("");
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchText, repo, hasQuant]);

  const openRepo = async (id: string) => {
    setRepo(id);
    setQuants([]);
    setError("");
    setLoadingQuants(true);
    try {
      setQuants(await getHuggingFaceQuants(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingQuants(false);
    }
  };

  const startPull = async (model: string) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setError("");
    setStatus("Starting...");
    setPulling(true);

    try {
      for await (const event of pullModel(model, controller.signal)) {
        if (event.total && event.completed !== undefined) {
          const pct = Math.floor((event.completed / event.total) * 100);
          setStatus(`Downloading ${pct}%`);
        } else {
          setStatus(event.status);
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["models"] });
      setValue("");
      setRepo(null);
      setStatus("");
      onPulled(model);
    } catch (err) {
      setStatus("");
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      abortRef.current = null;
      setPulling(false);
    }
  };

  const onEnter = () => {
    if (pulling) return;
    if (hasQuant && exactRef) void startPull(exactRef);
    else if (repoGuess) void openRepo(repoGuess);
  };

  const row =
    "flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700/60 cursor-pointer disabled:cursor-default disabled:opacity-50";
  const muted = "text-neutral-500 dark:text-neutral-400";

  return (
    <div className="border-t border-neutral-100 dark:border-neutral-700 text-sm">
      {repo ? (
        <div className="max-h-48 overflow-y-auto">
          <button
            type="button"
            disabled={pulling}
            onClick={() => {
              setRepo(null);
              setError("");
            }}
            className={`${row} ${muted}`}
          >
            <span aria-hidden>←</span>
            <span className="truncate">{repo}</span>
          </button>
          {loadingQuants && (
            <div className={`px-3 py-1.5 ${muted}`}>Checking quants...</div>
          )}
          {!loadingQuants && quants.length === 0 && !error && (
            <div className={`px-3 py-1.5 ${muted}`}>
              No pullable GGUF quants in this repo.
            </div>
          )}
          {quants.map((q) => (
            <button
              key={q.tag}
              type="button"
              disabled={pulling}
              onClick={() => void startPull(`hf.co/${repo}:${q.tag}`)}
              className={row}
            >
              <span className="flex-1 truncate">{q.tag}</span>
              <span className={muted}>{formatBytes(q.bytes)}</span>
            </button>
          ))}
        </div>
      ) : (
        results.length > 0 && (
          <div className="max-h-48 overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                disabled={pulling}
                onClick={() => void openRepo(r.id)}
                className={row}
              >
                <span className="flex-1 truncate">{r.id}</span>
                <span className={`shrink-0 ${muted}`}>
                  ↓{formatCount(r.downloads)} ♥{formatCount(r.likes)}
                </span>
              </button>
            ))}
          </div>
        )
      )}

      {!repo && (
        <div className="flex items-center gap-2 px-3 py-2">
          <input
            type="text"
            value={value}
            disabled={pulling}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              // keep Enter from reaching the model list's keyboard handler
              e.stopPropagation();
              if (e.key === "Enter") {
                e.preventDefault();
                onEnter();
              }
            }}
            placeholder="Search Hugging Face (GGUF)..."
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
          />
          {searching && <span className={muted}>...</span>}
        </div>
      )}

      {(status || pulling) && (
        <div className="flex items-center gap-2 px-3 pb-2">
          <span className={`flex-1 truncate ${muted}`}>{status}</span>
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className={`${muted} hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer`}
          >
            Cancel
          </button>
        </div>
      )}
      {error && (
        <div className="px-3 pb-2 break-words text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
