/**
 * Tests for UI spinner module
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createSpinner, withSpinner } from "../src/ui/index.js";

describe("createSpinner", () => {
  let originalIsTTY: boolean | undefined;
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let clearLineSpy: ReturnType<typeof vi.spyOn>;
  let cursorToSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalIsTTY = process.stdout.isTTY;
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    // In CI/non-TTY environments, clearLine and cursorTo don't exist
    // We need to add them before spying
    if (!process.stdout.clearLine) {
      (process.stdout as NodeJS.WriteStream).clearLine = () => true;
    }
    if (!process.stdout.cursorTo) {
      (process.stdout as NodeJS.WriteStream).cursorTo = () => true;
    }
    clearLineSpy = vi.spyOn(process.stdout, "clearLine").mockImplementation(() => true);
    cursorToSpy = vi.spyOn(process.stdout, "cursorTo").mockImplementation(() => true);
  });

  afterEach(() => {
    process.stdout.isTTY = originalIsTTY;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("in TTY mode", () => {
    beforeEach(() => {
      Object.defineProperty(process.stdout, "isTTY", { value: true, writable: true });
    });

    it("should create a spinner instance", () => {
      const spinner = createSpinner();

      expect(spinner).toHaveProperty("start");
      expect(spinner).toHaveProperty("update");
      expect(spinner).toHaveProperty("succeed");
      expect(spinner).toHaveProperty("fail");
      expect(spinner).toHaveProperty("warn");
      expect(spinner).toHaveProperty("stop");
      expect(spinner).toHaveProperty("isSpinning");
    });

    it("should report spinning state correctly", () => {
      vi.useFakeTimers();
      const spinner = createSpinner();

      expect(spinner.isSpinning()).toBe(false);
      spinner.start("Testing");
      expect(spinner.isSpinning()).toBe(true);
      spinner.stop();
      expect(spinner.isSpinning()).toBe(false);
    });

    it("should write to stdout when started", () => {
      vi.useFakeTimers();
      const spinner = createSpinner();

      spinner.start("Loading...");
      expect(writeSpy).toHaveBeenCalled();
      spinner.stop();
    });

    it("should clear line when stopped", () => {
      vi.useFakeTimers();
      const spinner = createSpinner();

      spinner.start("Loading...");
      spinner.stop();
      expect(clearLineSpy).toHaveBeenCalled();
    });

    it("should stop previous spinner when starting new one", () => {
      vi.useFakeTimers();
      const spinner = createSpinner();

      spinner.start("First");
      spinner.start("Second");
      // Should have cleared line for first spinner
      expect(clearLineSpy).toHaveBeenCalled();
      spinner.stop();
    });
  });

  describe("in non-TTY mode", () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      Object.defineProperty(process.stdout, "isTTY", { value: false, writable: true });
      consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("should print message once in non-TTY mode", () => {
      const spinner = createSpinner();

      spinner.start("Loading...");
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Loading..."));
      spinner.stop();
    });

    it("should print update messages in non-TTY mode", () => {
      const spinner = createSpinner();

      spinner.start("Loading...");
      spinner.update("Still loading...");
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Still loading..."));
      spinner.stop();
    });
  });

  describe("succeed/fail/warn", () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("should print success message with checkmark", () => {
      const spinner = createSpinner();

      spinner.succeed("Done!");
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Done!"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("✓"));
    });

    it("should print failure message with X", () => {
      const spinner = createSpinner();

      spinner.fail("Failed!");
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Failed!"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("✗"));
    });

    it("should print warning message with warning symbol", () => {
      const spinner = createSpinner();

      spinner.warn("Warning!");
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Warning!"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("⚠"));
    });
  });

  describe("indentation", () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("should use default indentation", () => {
      const spinner = createSpinner();

      spinner.succeed("Done!");
      // Default indent is 2 spaces
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/^ {2}/));
    });

    it("should use custom indentation", () => {
      const spinner = createSpinner({ indent: 4 });

      spinner.succeed("Done!");
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/^ {4}/));
    });
  });
});

describe("withSpinner", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should run async function with spinner", async () => {
    const result = await withSpinner("Loading", async () => {
      return 42;
    });

    expect(result).toBe(42);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("should show success message when function completes", async () => {
    await withSpinner("Loading", async () => {
      return "done";
    });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("✓"));
  });

  it("should show custom success message", async () => {
    await withSpinner(
      "Loading",
      async () => 5,
      { successMessage: "Loaded 5 items" }
    );

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Loaded 5 items"));
  });

  it("should support dynamic success message from result", async () => {
    await withSpinner(
      "Loading",
      async () => 10,
      { successMessage: (n) => `Loaded ${n} items` }
    );

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Loaded 10 items"));
  });

  it("should show failure message when function throws", async () => {
    await expect(
      withSpinner("Loading", async () => {
        throw new Error("Test error");
      })
    ).rejects.toThrow("Test error");

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("✗"));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("failed"));
  });

  it("should re-throw errors", async () => {
    const error = new Error("Test error");

    await expect(
      withSpinner("Loading", async () => {
        throw error;
      })
    ).rejects.toThrow(error);
  });
});
