/** Messages controlled by the interface, distinct from network failures. */
export class FormValidationError extends Error {
  constructor(public readonly fields: Record<string, string>) {
    super("Vérifiez les champs indiqués avant d’enregistrer.");
    this.name = "FormValidationError";
  }
}
