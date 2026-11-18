/** Move um lead de coluna na lista do quadro. Devolve a mesma lista se nada mudou (evita re-render à toa). */
export function moveLeadInBoard<T extends { id: string; stageId: string | null }>(leads: T[], leadId: string, stageId: string): T[] {
  const lead = leads.find((l) => l.id === leadId);
  if (!lead || lead.stageId === stageId) return leads;
  return leads.map((l) => (l.id === leadId ? { ...l, stageId } : l));
}
