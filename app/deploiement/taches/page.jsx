"use client";
import { Suspense } from "react";
import FichesTachesRIUSC from "../../components/FichesTaches";

export default function PageTaches() {
  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
      <Suspense fallback={<div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Chargement...</div>}>
        <FichesTachesRIUSC />
      </Suspense>
    </main>
  );
}