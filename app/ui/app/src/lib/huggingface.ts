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
