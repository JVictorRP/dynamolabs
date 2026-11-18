import { redirect } from "next/navigation";

/** As automações são configuradas só pela equipe da Dynamo, em Clientes → cliente → Automações. */
export default function AutomacoesPage() {
  redirect("/chatbot");
}
