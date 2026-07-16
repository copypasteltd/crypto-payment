import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import i18n from "./i18n";
import "./styles.css";
import { App } from "./app/App";
import { AdminErrorBoundary } from "./components/AdminErrorBoundary";
import { GlobalErrorBridge, ToastViewport } from "./components/ToastViewport";
import { AdminApiError } from "./lib/api";
import { notifyUnexpectedError } from "./lib/toast";

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (!(error instanceof AdminApiError)) notifyUnexpectedError(error, i18n.t("common:toast.dataLoadFailed"));
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      if (!(error instanceof AdminApiError)) notifyUnexpectedError(error, i18n.t("common:toast.operationFailed"));
    },
  }),
  defaultOptions: {
    queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <GlobalErrorBridge />
        <ToastViewport />
        <AdminErrorBoundary><App /></AdminErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
