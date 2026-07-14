export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "detail" in error
  ) {
    return String((error as { detail: unknown }).detail);
  }

  return "An unexpected error occurred.";
}

export function isNetworkError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes("network")
  );
}