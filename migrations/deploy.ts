// Migrations are for early features like deploying the program to a new cluster.
// For most programs, this file can be left empty.
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Trustport } from "../target/types/trustport";

export default async function (provider: anchor.AnchorProvider) {
  anchor.setProvider(provider);
  const program = anchor.workspace.Trustport as Program<Trustport>;
  
  // Add migration logic here if needed
}
