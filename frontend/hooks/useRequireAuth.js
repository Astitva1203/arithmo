import { useRouter } from "next/router";
import { useEffect } from "react";
import { useAuthStore } from "./useAuthStore";

export const useRequireAuth = () => {
  const router = useRouter();
  const { user, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (user === null) {
      const token = typeof window !== "undefined" ? localStorage.getItem("arithmo_token") : null;
      if (!token) router.replace("/signin");
    }
  }, [router, user]);

  return { user };
};
