import { describe, expect, it } from "vitest";
import { normalizeHuggingFaceRef } from "./huggingface";

describe("normalizeHuggingFaceRef", () => {
  it.each([
    ["unsloth/Qwen3.8-27B-GGUF", "hf.co/unsloth/Qwen3.8-27B-GGUF"],
    ["unsloth/Qwen3.8-27B-GGUF:Q4_K_M", "hf.co/unsloth/Qwen3.8-27B-GGUF:Q4_K_M"],
    ["hf.co/unsloth/Qwen3.8-27B-GGUF:IQ4_XS", "hf.co/unsloth/Qwen3.8-27B-GGUF:IQ4_XS"],
    ["  https://huggingface.co/unsloth/Qwen3.8-27B-GGUF  ", "hf.co/unsloth/Qwen3.8-27B-GGUF"],
    ["https://huggingface.co/unsloth/Qwen3.8-27B-GGUF/", "hf.co/unsloth/Qwen3.8-27B-GGUF"],
    ["https://huggingface.co/unsloth/Qwen3.8-27B-GGUF/tree/main", "hf.co/unsloth/Qwen3.8-27B-GGUF"],
    ["huggingface.co/a/b/blob/main/b-Q4_K_M.gguf", "hf.co/a/b"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeHuggingFaceRef(input)).toBe(expected);
  });

  it.each(["", "llama3", "a/b/c", "https://example.com/a/b", "a b/c"])(
    "rejects %j",
    (input) => {
      expect(normalizeHuggingFaceRef(input)).toBeNull();
    },
  );
});
