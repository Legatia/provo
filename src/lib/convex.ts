import { ConvexReactClient, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export const convex = new ConvexReactClient(
  (import.meta as any).env.VITE_CONVEX_URL as string
);

export { useQuery, useMutation, api };
