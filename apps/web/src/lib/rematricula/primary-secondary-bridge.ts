/**
 * A pupil who completed 6th class may continue into the 7th class even though
 * the school models Ensino Primário and Ensino Secundário as distinct courses.
 *
 * This never establishes approval: the caller must have a separately verified
 * eligible RAA decision, source/target school and selected academic years.
 * No arbitrary course transfer, repeat, skipped class or final-cycle override.
 */
export function isPrimarySecondaryBridge(input: {
  sourceClass: number | null | undefined;
  destinationClass: number | null | undefined;
  sourceLevel: string | null | undefined;
  destinationLevel: string | null | undefined;
  mode: "regular" | "conditional" | "repeat" | null | undefined;
}): boolean {
  return input.sourceClass === 6 &&
    input.destinationClass === 7 &&
    input.sourceLevel?.trim().toLowerCase() === "primario" &&
    input.destinationLevel?.trim().toLowerCase() === "secundario" &&
    (input.mode === "regular" || input.mode === "conditional");
}
