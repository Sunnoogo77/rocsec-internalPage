import type { ComponentType } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { MainLayout } from "./components/layout/MainLayout";
import { LoginPage } from "./routes/Login";
import { DashboardPage } from "./routes/Dashboard";
import { SermonsListPage } from "./routes/sermons/SermonsList";
import { SermonEditPage } from "./routes/sermons/SermonEdit";
import { SeriesPage } from "./routes/sermons/SeriesPage";
import { CantiquesListPage } from "./routes/cantiques/CantiquesList";
import { CantiqueEditPage } from "./routes/cantiques/CantiqueEdit";
import { AnnoncesListPage } from "./routes/annonces/AnnoncesList";
import { AnnonceEditPage } from "./routes/annonces/AnnonceEdit";
import { TemoignagesPage } from "./routes/temoignages/TemoignagesQueue";
import { TemoignageEditPage } from "./routes/temoignages/TemoignageEdit";
import { CetteSemainePage } from "./routes/CetteSemaine";
import { NehemiePage } from "./routes/Nehemie";
import { PersonnesPage } from "./routes/Personnes";
import { MediathequePage } from "./routes/Mediatheque";
import { MotDuPasteurPage } from "./routes/MotDuPasteur";
import { ReglagesPage } from "./routes/Reglages";

import { ComptesPage } from "./routes/Comptes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function EditorRoute({ component: Component }: { component: ComponentType }) {
  const { pathname } = useLocation();
  return <Component key={pathname} />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="sermons" element={<SermonsListPage />} />
              <Route path="sermons/series" element={<SeriesPage />} />
              <Route path="sermons/nouveau" element={<EditorRoute component={SermonEditPage} />} />
              <Route path="sermons/:slug" element={<EditorRoute component={SermonEditPage} />} />
              <Route path="cantiques" element={<CantiquesListPage />} />
              <Route
                path="cantiques/nouveau"
                element={<EditorRoute component={CantiqueEditPage} />}
              />
              <Route
                path="cantiques/:slug"
                element={<EditorRoute component={CantiqueEditPage} />}
              />
              <Route path="annonces" element={<AnnoncesListPage />} />
              <Route
                path="annonces/nouvelle"
                element={<EditorRoute component={AnnonceEditPage} />}
              />
              <Route path="annonces/:slug" element={<EditorRoute component={AnnonceEditPage} />} />
              <Route path="temoignages" element={<TemoignagesPage />} />
              <Route
                path="temoignages/nouveau"
                element={<EditorRoute component={TemoignageEditPage} />}
              />
              <Route
                path="temoignages/:slug"
                element={<EditorRoute component={TemoignageEditPage} />}
              />
              <Route path="cette-semaine" element={<CetteSemainePage />} />
              <Route path="nehemie" element={<NehemiePage />} />
              <Route path="personnes" element={<PersonnesPage />} />
              <Route path="medias" element={<MediathequePage />} />
              <Route path="mot-du-pasteur" element={<MotDuPasteurPage />} />
              <Route path="comptes" element={<ComptesPage />} />
              <Route path="reglages" element={<ReglagesPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
