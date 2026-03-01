const anchor = require("@coral-xyz/anchor");

describe("biometric_access", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  it("Is initialized!", async () => {
    // Add your test here.
    const program = anchor.workspace.biometricAccess;
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
