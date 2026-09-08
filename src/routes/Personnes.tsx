import { IdentityCheck, useWorkflowAccess } from "@/components/forms/WorkflowAccess";
import { useAuth } from "@/auth/AuthContext";
import { usePeople, normalizeSearch, personName, roleCodes, roleLabel } from "@/lib/people";
import { QueryFeedback } from "@/components/ui/QueryFeedback";
import common from "./common.module.css";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Users } from "lucide-react";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PageBody, PageHead } from "@/components/layout/MainLayout";
import { GroupesPanel } from "./personnes/GroupesPanel";
import {
  Badge,
  Button,
  Input,
  Modal,
  Select,
  Table,
  TableEmpty,
  TableWrap,
  TablePager,
  Toggle,
  tableClasses,
} from "@/components/ui";
import { RolesMultiSelect } from "@/components/forms/RolesMultiSelect";
import { personnesApi } from "@/api";
import { HttpError } from "@/api/client";
import type { Personne } from "@/types";

interface DraftState {
  civilite: string;
  prenom: string;
  nom: string;
  nom_affichage: string;
  roles: string[];
  bio_courte_fr: string;
  bio_courte_en: string;
  actif: boolean;
}

function emptyDraft(): DraftState {
  return {
    civilite: "Fr.",
    prenom: "",
    nom: "",
    nom_affichage: "",
    roles: [],
    bio_courte_fr: "",
    bio_courte_en: "",
    actif: true,
  };
}

export function PersonnesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const access = useWorkflowAccess();
  const canEdit = Boolean(user?.is_superuser || user?.role === "validateur");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [activity, setActivity] = useState("active");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Personne | null>(null);
  const [draft, setDraft] = useState<DraftState>(emptyDraft());
  const [confirmDelete, setConfirmDelete] = useState<Personne | null>(null);
  const [groupesOpen, setGroupesOpen] = useState(false);

  const query = usePeople();
  const roles = [
    ...new Map(
      (query.data ?? []).flatMap((p) =>
        (p.roles_detail ?? []).filter((r) => r.actif).map((r) => [r.code, r.libelle_fr] as const),
      ),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1], "fr"));
  const filtered = (query.data ?? []).filter(
    (p) =>
      normalizeSearch(`${personName(p)} ${p.prenom} ${p.nom}`).includes(normalizeSearch(search)) &&
      (activity === "all" || p.actif === (activity === "active")) &&
      (!role ||
        (role === "unclassified" ? roleCodes(p).length === 0 : roleCodes(p).includes(role))),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 25));
  const currentPage = Math.min(page, pages);
  const rows = filtered.slice((currentPage - 1) * 25, currentPage * 25);

  const save = useMutation({
    mutationFn: () => {
      if (!draft.prenom.trim() || !draft.nom.trim())
        throw new Error("Renseignez le prénom et le nom.");
      return editing ? personnesApi.update(editing.id, draft) : personnesApi.create(draft);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith("personne"),
      });
      void queryClient.invalidateQueries({ queryKey: ["personnes-search"] });
      void queryClient.invalidateQueries({ queryKey: ["personnes-selected"] });
      setOpen(false);
      setEditing(null);
      setDraft(emptyDraft());
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => personnesApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith("personne"),
      });
      void queryClient.invalidateQueries({ queryKey: ["personnes-search"] });
      void queryClient.invalidateQueries({ queryKey: ["personnes-selected"] });
      setConfirmDelete(null);
    },
  });

  const startCreate = () => {
    save.reset();
    setEditing(null);
    setDraft(emptyDraft());
    setOpen(true);
  };

  const startEdit = (personne: Personne) => {
    save.reset();
    setEditing(personne);
    setDraft({
      civilite: personne.civilite,
      prenom: personne.prenom,
      nom: personne.nom,
      nom_affichage: personne.nom_affichage,
      roles: personne.roles ?? (personne.roles_detail ?? []).map((r) => r.id),
      bio_courte_fr: personne.bio_courte_fr,
      bio_courte_en: personne.bio_courte_en,
      actif: personne.actif,
    });
    setOpen(true);
  };

  const saveError = save.error instanceof Error ? save.error : null;
  const removeError = remove.error instanceof HttpError ? remove.error : null;

  return (
    <>
      <Breadcrumb items={[{ label: "Personnes" }]} />
      <PageHead
        title="Personnes"
        lede="Pasteurs, prédicateurs, solistes, choristes — une fiche par individu, autant de rôles que nécessaire."
        actions={
          <>
            <Button
              disabled={!canEdit}
              variant="ghost"
              leftIcon={<Users size={14} />}
              onClick={() => setGroupesOpen(true)}
              title="Créer des groupes (ex. « Chœurs ») pour les utiliser comme interprète de cantiques"
            >
              Gérer les groupes
            </Button>
            <Button
              disabled={!canEdit}
              variant="primary"
              leftIcon={<Plus size={14} />}
              onClick={startCreate}
            >
              Ajouter une personne
            </Button>
          </>
        }
      />

      {groupesOpen && <GroupesPanel onClose={() => setGroupesOpen(false)} />}
      <PageBody>
        <div className={common.filters}>
          <div className={common.search}>
            <Input
              label="Rechercher une personne"
              placeholder="Nom ou prénom"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            label="Rôle"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tous les rôles</option>
            <option value="unclassified">Sans rôle attribué</option>
            {roles.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </Select>
          <Select
            label="Présence dans les sélections"
            value={activity}
            onChange={(e) => {
              setActivity(e.target.value);
              setPage(1);
            }}
          >
            <option value="active">Personnes actives</option>
            <option value="inactive">Personnes inactives</option>
            <option value="all">Toutes les personnes</option>
          </Select>
        </div>
        <p className={common.notice} style={{ marginBottom: 20 }}>
          {canEdit
            ? "Attribuez les rôles correspondant au service de chaque personne. Seules les fiches actives avec le rôle Pasteur ou Prédicateur sont proposées pour un culte. Une vérification récente de votre identité est nécessaire pour enregistrer."
            : "Vous pouvez consulter le répertoire. Un validateur peut créer ou modifier les fiches et leurs rôles."}
        </p>
        <QueryFeedback
          loading={query.isLoading}
          error={query.error}
          retry={() => void query.refetch()}
        />
        {query.isSuccess && (
          <TableWrap>
            {rows.length ? (
              <Table>
                <thead>
                  <tr>
                    <th>Personne</th>
                    <th>Rôles attribués</th>
                    <th>Disponibilité</th>
                    <th>Fiche</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id}>
                      <td className={tableClasses.title}>{personName(p)}</td>
                      <td>
                        <Badge>{roleLabel(p)}</Badge>
                      </td>
                      <td>{p.actif ? "Active" : "Inactive"}</td>
                      <td>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(p)}
                          aria-label={`${canEdit ? "Modifier" : "Consulter"} ${personName(p)}`}
                        >
                          {canEdit ? "Modifier" : "Consulter"}
                        </Button>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Supprimer ${personName(p)}`}
                            onClick={() => {
                              remove.reset();
                              setConfirmDelete(p);
                            }}
                          >
                            <Trash2 size={15} />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <TableEmpty
                message={
                  query.data.length
                    ? "Aucune personne ne correspond aux filtres. Essayez un autre rôle ou affichez toutes les personnes."
                    : "Le répertoire est vide. Ajoutez une personne et attribuez-lui ses rôles."
                }
              />
            )}
            <TablePager>
              <span>
                {filtered.length} personne{filtered.length > 1 ? "s" : ""} · Page {currentPage} sur{" "}
                {pages}
              </span>
              <Button
                variant="ghost"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                Précédente
              </Button>
              <Button
                variant="ghost"
                disabled={currentPage >= pages}
                onClick={() => setPage(currentPage + 1)}
              >
                Suivante
              </Button>
            </TablePager>
          </TableWrap>
        )}
      </PageBody>

      {/* Modale créer / modifier */}
      <Modal
        open={open}
        onClose={() => {
          if (!save.isPending) setOpen(false);
        }}
        title={editing ? "Modifier une personne" : "Nouvelle personne"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={() => save.mutate()}
              disabled={
                !access.canManage || save.isPending || !draft.prenom.trim() || !draft.nom.trim()
              }
            >
              {save.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </>
        }
      >
        <fieldset disabled={!access.canManage || save.isPending} className={common.formGrid}>
          <Select
            label="Civilité"
            value={draft.civilite}
            onChange={(event) => setDraft({ ...draft, civilite: event.target.value })}
          >
            <option value="Rév.">Rév.</option>
            <option value="Past.">Past.</option>
            <option value="Pasteur">Pasteur</option>
            <option value="Fr.">Fr.</option>
            <option value="Sœur">Sœur</option>
            <option value="autre">autre</option>
          </Select>
          <Input
            label="Prénom"
            value={draft.prenom}
            onChange={(event) => setDraft({ ...draft, prenom: event.target.value })}
            required
          />
          <Input
            label="Nom"
            value={draft.nom}
            onChange={(event) => setDraft({ ...draft, nom: event.target.value })}
            required
          />
          <div style={{ gridColumn: "1 / -1" }}>
            <Input
              label="Nom affiché (facultatif)"
              value={draft.nom_affichage}
              onChange={(event) => setDraft({ ...draft, nom_affichage: event.target.value })}
              help="Si vide : calculé depuis civilité + prénom + nom."
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <RolesMultiSelect
              value={draft.roles}
              onChange={(ids) => setDraft({ ...draft, roles: ids })}
              help="Plusieurs rôles sont possibles. La civilité ne détermine pas les rôles de la personne."
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <Toggle
              checked={draft.actif}
              onChange={(next) => setDraft({ ...draft, actif: next })}
              label="Personne active"
            />
          </div>
          {saveError ? (
            <p style={{ gridColumn: "1 / -1", color: "var(--red-700)", fontSize: 13, margin: 0 }}>
              {saveError.message}
            </p>
          ) : null}
        </fieldset>
      </Modal>

      {/* Modale confirmation suppression */}
      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Supprimer cette personne ?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={() => confirmDelete && remove.mutate(confirmDelete.id)}
              disabled={remove.isPending || !access.canManage}
            >
              {remove.isPending ? "Suppression…" : "Supprimer définitivement"}
            </Button>
          </>
        }
      >
        {!access.recent && <IdentityCheck />}
        <p style={{ margin: "0 0 8px" }}>
          Vous êtes sur le point de supprimer <strong>{confirmDelete?.libelle}</strong>.
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "var(--gray-500)" }}>
          Cette action est <strong>irréversible</strong>. Si cette personne est référencée comme
          prédicateur ou interprète, la suppression sera refusée par le serveur.
        </p>
        {removeError ? (
          <p style={{ color: "var(--red-700)", fontSize: 13, marginTop: 12 }}>
            {removeError.message}
          </p>
        ) : null}
      </Modal>
    </>
  );
}
