import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Personne | null>(null);
  const [draft, setDraft] = useState<DraftState>(emptyDraft());
  const [confirmDelete, setConfirmDelete] = useState<Personne | null>(null);
  const [groupesOpen, setGroupesOpen] = useState(false);

  const query = useQuery({
    queryKey: ["personnes-list"],
    queryFn: () => personnesApi.list({ page_size: 100 }),
  });

  const save = useMutation({
    mutationFn: () =>
      editing
        ? personnesApi.update(editing.id, draft)
        : personnesApi.create(draft),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["personnes-list"] });
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
      void queryClient.invalidateQueries({ queryKey: ["personnes-list"] });
      void queryClient.invalidateQueries({ queryKey: ["personnes-search"] });
      void queryClient.invalidateQueries({ queryKey: ["personnes-selected"] });
      setConfirmDelete(null);
    },
  });

  const startCreate = () => {
    setEditing(null);
    setDraft(emptyDraft());
    setOpen(true);
  };

  const startEdit = (personne: Personne) => {
    setEditing(personne);
    setDraft({
      civilite: personne.civilite,
      prenom: personne.prenom,
      nom: personne.nom,
      nom_affichage: personne.nom_affichage,
      roles:
        personne.roles ??
        (personne.roles_detail ?? []).map((r) => r.id),
      bio_courte_fr: personne.bio_courte_fr,
      bio_courte_en: personne.bio_courte_en,
      actif: personne.actif,
    });
    setOpen(true);
  };

  const saveError = save.error instanceof HttpError ? save.error : null;
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
              variant="ghost"
              leftIcon={<Users size={14} />}
              onClick={() => setGroupesOpen(true)}
              title="Créer des groupes (ex. « Chœurs ») pour les utiliser comme interprète de cantiques"
            >
              Gérer les groupes
            </Button>
            <Button variant="primary" leftIcon={<Plus size={14} />} onClick={startCreate}>
              Ajouter une personne
            </Button>
          </>
        }
      />

      {groupesOpen && <GroupesPanel onClose={() => setGroupesOpen(false)} />}
      <PageBody>
        <TableWrap>
          {query.data?.results.length ? (
            <Table>
              <thead>
                <tr>
                  <th>Civilité</th>
                  <th>Prénom</th>
                  <th>Nom</th>
                  <th>Rôles</th>
                  <th>Actif</th>
                  <th style={{ width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {query.data.results.map((p) => (
                  <tr key={p.id}>
                    <td onClick={() => startEdit(p)} style={{ cursor: "pointer" }}>
                      {p.civilite}
                    </td>
                    <td
                      className={tableClasses.title}
                      onClick={() => startEdit(p)}
                      style={{ cursor: "pointer" }}
                    >
                      {p.prenom}
                    </td>
                    <td onClick={() => startEdit(p)} style={{ cursor: "pointer" }}>
                      {p.nom}
                    </td>
                    <td>
                      {(p.roles_detail ?? []).length > 0 ? (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {(p.roles_detail ?? []).map((r) => (
                            <Badge key={r.id}>{r.libelle_fr}</Badge>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: "#9ca3af", fontStyle: "italic" }}>
                          aucun
                        </span>
                      )}
                    </td>
                    <td>{p.actif ? "Oui" : "Non"}</td>
                    <td>
                      <Button
                        variant="dangerOutline"
                        size="icon"
                        aria-label={`Supprimer ${p.libelle}`}
                        onClick={() => setConfirmDelete(p)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <TableEmpty
              message={query.isLoading ? "Chargement…" : "Aucune personne enregistrée."}
            />
          )}
        </TableWrap>
      </PageBody>

      {/* Modale créer / modifier */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Modifier une personne" : "Nouvelle personne"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              {save.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
              label="Nom d'affichage (override)"
              value={draft.nom_affichage}
              onChange={(event) => setDraft({ ...draft, nom_affichage: event.target.value })}
              help="Si vide : calculé depuis civilité + prénom + nom."
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <RolesMultiSelect
              value={draft.roles}
              onChange={(ids) => setDraft({ ...draft, roles: ids })}
              help="Sélectionne tous les rôles qui s'appliquent. Bouton « + Nouveau rôle » pour en ajouter un qui n'existe pas encore."
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
            <p style={{ gridColumn: "1 / -1", color: "#991b1b", fontSize: 13, margin: 0 }}>
              {saveError.message}
            </p>
          ) : null}
        </div>
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
              disabled={remove.isPending}
            >
              {remove.isPending ? "Suppression…" : "Supprimer définitivement"}
            </Button>
          </>
        }
      >
        <p style={{ margin: "0 0 8px" }}>
          Vous êtes sur le point de supprimer{" "}
          <strong>{confirmDelete?.libelle}</strong>.
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
          Cette action est <strong>irréversible</strong>. Si cette personne est
          référencée comme prédicateur ou interprète, la suppression sera
          refusée par le serveur.
        </p>
        {removeError ? (
          <p style={{ color: "#991b1b", fontSize: 13, marginTop: 12 }}>
            {removeError.message}
          </p>
        ) : null}
      </Modal>
    </>
  );
}
