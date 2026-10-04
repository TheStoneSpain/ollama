const HF_REF = /^([\w.-]+)\/([\w.-]+)(?::([\w.-]+))?$/;
const HF_PREFIX = /^(?:https?:\/\/)?(?:www\.)?(?:huggingface\.co|hf\.co)\//i;

// Converts "org/repo[:quant]", "hf.co/org/repo[:quant]" or a Hugging Face
// repo URL into the model name Ollama pulls: "hf.co/org/repo[:quant]".
// Returns null when the input is not a valid repo reference.
export function normalizeHuggingFaceRef(input: string): string | null {
  let ref = input.trim().replace(HF_PREFIX, "");

  // Repo page URLs: org/repo/tree/main, org/repo/blob/main/file.gguf, ...
  ref = ref.replace(/^([^/?#]+\/[^/?#]+?)\/(?:tree|blob|resolve)\/.*$/, "$1");
  ref = ref.replace(/[?#].*$/, "").replace(/\/+$/, "");

  const match = HF_REF.exec(ref);
  if (!match) return null;

  const [, org, repo, quant] = match;
  return `hf.co/${org}/${repo}${quant ? `:${quant}` : ""}`;
}

const HF_API = "https://huggingface.co/api";
const HF_REGISTRY = "https://huggingface.co/v2";

export interface HuggingFaceResult {
  id: string;
  downloads: number;
  likes: number;
}

export interface HuggingFaceQuant {
  tag: string;
  bytes: number;
}

// "dir/Model-IQ4_XS.gguf" or "Model-Q4_K_M-00001-of-00003.gguf" -> quant tag.
// Returns null for projector files and names without a "-<tag>" suffix. The
// registry is still the source of truth for which tags can be pulled.
export function quantFromFilename(path: string): string | null {
  const name = path.split("/").pop() ?? "";
  if (!/\.gguf$/i.test(name) || /mmproj/i.test(name)) return null;
  const stem = name.replace(/\.gguf$/i, "").replace(/-\d{5}-of-\d{5}$/i, "");
  const idx = stem.lastIndexOf("-");
  return idx >= 0 && idx < stem.length - 1 ? stem.slice(idx + 1) : null;
}

export async function searchHuggingFaceModels(
  query: string,
  signal?: AbortSignal,
): Promise<HuggingFaceResult[]> {
  const params = new URLSearchParams({
    search: query,
    filter: "gguf",
    sort: "downloads",
    direction: "-1",
    limit: "12",
  });
  const response = await fetch(`${HF_API}/models?${params}`, { signal });
  if (!response.ok) {
    throw new Error(`Hugging Face search failed: ${response.statusText}`);
  }
  const data: { id: string; downloads?: number; likes?: number }[] =
    await response.json();
  return data.map((m) => ({
    id: m.id,
    downloads: m.downloads ?? 0,
    likes: m.likes ?? 0,
  }));
}

// Lists the quants of a repo that Ollama can actually pull, smallest first.
export async function getHuggingFaceQuants(
  repo: string,
  signal?: AbortSignal,
): Promise<HuggingFaceQuant[]> {
  const response = await fetch(`${HF_API}/models/${repo}?blobs=true`, {
    signal,
  });
  if (!response.ok) {
    throw new Error(`Could not read ${repo}: ${response.statusText}`);
  }
  const info: { siblings?: { rfilename: string; size?: number }[] } =
    await response.json();

  const sizes = new Map<string, number>();
  for (const file of info.siblings ?? []) {
    const tag = quantFromFilename(file.rfilename);
    if (tag) sizes.set(tag, (sizes.get(tag) ?? 0) + (file.size ?? 0));
  }

  const checked = await Promise.all(
    [...sizes].map(async ([tag, bytes]) => {
      try {
        const r = await fetch(`${HF_REGISTRY}/${repo}/manifests/${tag}`, {
          headers: {
            Accept: "application/vnd.docker.distribution.manifest.v2+json",
          },
          signal,
        });
        return r.ok ? { tag, bytes } : null;
      } catch (err) {
        if (signal?.aborted) throw err;
        return { tag, bytes }; // could not verify; let the pull decide
      }
    }),
  );
  return checked
    .filter((q): q is HuggingFaceQuant => q !== null)
    .sort((a, b) => a.bytes - b.bytes);
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "";
  return `${(bytes / 1e9).toFixed(1)} GB`;
}

export function formatCount(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}
