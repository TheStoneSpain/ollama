import { describe, expect, it } from "vitest";
import {
  formatBytes,
  normalizeHuggingFaceRef,
  quantFromFilename,
} from "./huggingface";

describe("normalizeHuggingFaceRef", () => {
  it.each([
    ["unsloth/Qwen3.8-27B-GGUF", "hf.co/unsloth/Qwen3.8-27B-GGUF"],
    [
      "unsloth/Qwen3.8-27B-GGUF:Q4_K_M",
      "hf.co/unsloth/Qwen3.8-27B-GGUF:Q4_K_M",
    ],
    [
      "hf.co/unsloth/Qwen3.8-27B-GGUF:IQ4_XS",
      "hf.co/unsloth/Qwen3.8-27B-GGUF:IQ4_XS",
    ],
    [
      "  https://huggingface.co/unsloth/Qwen3.8-27B-GGUF  ",
      "hf.co/unsloth/Qwen3.8-27B-GGUF",
    ],
    [
      "https://huggingface.co/unsloth/Qwen3.8-27B-GGUF/",
      "hf.co/unsloth/Qwen3.8-27B-GGUF",
    ],
    [
      "https://huggingface.co/unsloth/Qwen3.8-27B-GGUF/tree/main",
      "hf.co/unsloth/Qwen3.8-27B-GGUF",
    ],
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

describe("quantFromFilename", () => {
  it.each([
    ["Model-IQ4_XS.gguf", "IQ4_XS"],
    ["Q4_K_M/Model-Q4_K_M-00001-of-00003.gguf", "Q4_K_M"],
    ["Qwen3.8-27B-Uncensored-HauhauCS-Aggressive-Q6_K_P.gguf", "Q6_K_P"],
  ])("extracts the tag from %s", (path, tag) => {
    expect(quantFromFilename(path)).toBe(tag);
  });

  it.each([
    "mmproj-Model-BF16.gguf",
    "README.md",
    "model.safetensors",
    "plain.gguf",
  ])("ignores %s", (path) => {
    expect(quantFromFilename(path)).toBeNull();
  });
});

describe("formatBytes", () => {
  it("formats sizes", () => {
    expect(formatBytes(15.7e9)).toBe("15.7 GB");
    expect(formatBytes(25.9e9)).toBe("25.9 GB");
    expect(formatBytes(0)).toBe("");
  });
});
