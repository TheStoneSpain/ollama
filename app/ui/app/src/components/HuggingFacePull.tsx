import { useRef, useState, type JSX } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { pullModel } from "@/api";
import { normalizeHuggingFaceRef } from "@/lib/huggingface";

export function HuggingFacePull({
  onPulled,
}: {
  onPulled: (model: string) => void;
}): JSX.Element {
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pulling, setPulling] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const startPull = async () => {
    const model = normalizeHuggingFaceRef(value);
    if (!model) {
      setError("Use org/repo or org/repo:quant, e.g. unsloth/Qwen3.8-27B-GGUF");
      return;
    }

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
      setStatus("");
      onPulled(model);
    } catch (err) {
      if (controller.signal.aborted) {
        setStatus("");
      } else {
        setStatus("");
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      abortRef.current = null;
      setPulling(false);
    }
  };

  return (
    <div className="px-3 py-2 border-t border-neutral-100 dark:border-neutral-700 text-sm">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          disabled={pulling}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // keep Enter from reaching the model list's keyboard handler
            e.stopPropagation();
            if (e.key === "Enter" && !pulling) {
              e.preventDefault();
              void startPull();
            }
          }}
          placeholder="Pull from Hugging Face: org/repo:quant"
          autoCorrect="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
        />
        {pulling ? (
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer"
          >
            Cancel
          </button>
        ) : (
          <button
            type="button"
            disabled={!value.trim()}
            onClick={() => void startPull()}
            className="text-blue-600 disabled:opacity-40 dark:text-blue-400 cursor-pointer disabled:cursor-default"
          >
            Pull
          </button>
        )}
      </div>
      {status && (
        <div className="mt-1 truncate text-neutral-500 dark:text-neutral-400">
          {status}
        </div>
      )}
      {error && (
        <div className="mt-1 break-words text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
