import type { Metadata } from "next";
import { PracticeView } from "@/components/PracticeView";

export const metadata: Metadata = {
  title: "Treino Livre — digite código sem sala",
  description:
    "Treine digitação de código sozinho no CodeRacer: escolha linguagem e dificuldade e corra contra o relógio — sem sala, sem cadastro.",
  alternates: { canonical: "/practice" }
};

export default function PracticePage() {
  return <PracticeView />;
}
