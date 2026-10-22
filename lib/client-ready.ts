"use client";
import { useSyncExternalStore } from "react";
const subscribe = () => () => {};
const browserSnapshot = () => true;
const serverSnapshot = () => false;
// Browser storage and the local clock are read only after hydration.
export function useClientReady() { return useSyncExternalStore(subscribe, browserSnapshot, serverSnapshot); }
