"use client";

import { useEffect, useState } from "react";
import {
  getTyreStrategy,
  TyreStrategyResponse,
} from "@/services/tyreStrategyService";

export function useTyreStrategy(
  event_name: string,
  session_name: string,
  driver: string
) {
  const [data, setData] = useState<TyreStrategyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!event_name || !session_name || !driver) return;

    setLoading(true);

    getTyreStrategy(event_name, session_name, driver)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [event_name, session_name, driver]);

  return {
    data,
    loading,
    error,
  };
}