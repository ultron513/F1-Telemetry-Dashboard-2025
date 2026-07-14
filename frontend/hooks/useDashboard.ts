"use client";

import { useState } from "react";

import { useRaces } from "./useRaces";
import { useSessions } from "./useSessions";
import { useDrivers } from "./useDrivers";
import { useLaps } from "./useLaps";

export function useDashboard() {
  const [event, setEvent] = useState("");
  const [session, setSession] = useState("");
  const [driver, setDriver] = useState("");
  const [compareDriver, setCompareDriver] = useState("");
  const [lap, setLap] = useState("1");

  const races = useRaces();
  console.log("RACES:", races.data);
  console.log("RACES ERROR:", races.error);
  console.log("RACES STATUS:", races.status);

  const sessions = useSessions(event);

  const drivers = useDrivers(
    event,
    session
  );

  const laps = useLaps(
    event,
    session,
    driver
    );

  return {
    event,
    setEvent,

    session,
    setSession,
    compareDriver,
    setCompareDriver,
    driver,
    setDriver,

    races,
    sessions,
    drivers,
    laps,
    lap,
    setLap,
  };
}