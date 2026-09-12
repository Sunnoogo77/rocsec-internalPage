import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PageBody, PageHead } from "@/components/layout/MainLayout";
import { Button, Card, Input, Select } from "@/components/ui";

interface ManagedAccount {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  role: "editeur" | "validateur";
  is_active: boolean;
}

export function ComptesPage() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"editeur" | "validateur">("editeur");
  const accounts = useQuery({
    queryKey: ["accounts"],
    enabled: Boolean(user?.is_superuser),
    queryFn: () => api.get<{ results: ManagedAccount[] }>("/auth/users/"),
  });
  const create = useMutation({
    mutationFn: () => api.post("/auth/users/", { username, password, role }),
    onSuccess: () => {
      setUsername("");
      setPassword("");
      void cache.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
  const update = useMutation({
    mutationFn: (account: ManagedAccount) =>
      api.patch(`/auth/users/${account.id}/`, { is_active: !account.is_active }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
  if (!user?.is_superuser)
    return (
      <PageBody>
        <p>La gestion des comptes est réservée au superadministrateur.</p>
      </PageBody>
    );
  const error = accounts.error || create.error || update.error;
  return (
    <>
      <Breadcrumb items={[{ label: "Équipe et accès" }]} />
      <PageHead
        title="Équipe et accès"
        lede="Attribuez à chacun les accès nécessaires à son service."
      />
      <PageBody>
        <p className="securityNotice">
          Une vérification récente est nécessaire.{" "}
          <Link to="/reglages">Vérifier mon identité dans Réglages</Link>
        </p>
        {error && (
          <p role="alert" className="errorNotice">
            {error.message}
          </p>
        )}
        <div className="settingsGrid">
          <Card title="Comptes de l’équipe">
            {accounts.isLoading ? (
              <p>Chargement des comptes…</p>
            ) : (
              <div className="accountList">
                {accounts.data?.results.map((account) => (
                  <div key={account.id} className="accountRow">
                    <div>
                      <strong>{account.username}</strong>
                      <p>
                        {account.role === "validateur" ? "Validateur" : "Éditeur"} ·{" "}
                        {account.is_active ? "Actif" : "Désactivé"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      disabled={account.id === user.id || update.isPending}
                      onClick={() => update.mutate(account)}
                    >
                      {account.is_active ? "Désactiver" : "Réactiver"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card title="Ajouter une personne habilitée">
            <form
              className="settingsForm"
              onSubmit={(event) => {
                event.preventDefault();
                create.mutate();
              }}
            >
              <Input
                label="Nom d’utilisateur"
                type="text"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={150}
                placeholder="frere.jean"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <Select
                label="Rôle"
                value={role}
                onChange={(e) => setRole(e.target.value as "editeur" | "validateur")}
              >
                <option value="editeur">Éditeur — préparer les contenus</option>
                <option value="validateur">Validateur — relire et publier</option>
              </Select>
              <Input
                label="Mot de passe initial"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={12}
                maxLength={256}
                required
                autoComplete="new-password"
                help="Au moins 12 caractères. À transmettre directement à la personne concernée."
              />
              <Button type="submit" variant="primary" disabled={create.isPending}>
                {create.isPending ? "Création…" : "Créer le compte"}
              </Button>
              {create.isSuccess && (
                <p role="status">
                  Le compte est créé. La personne pourra changer son mot de passe dans Réglages.
                </p>
              )}
            </form>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
