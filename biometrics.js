// Criar chave biométrica
async function createBiometricKey() {
    return await navigator.credentials.create({
        publicKey: {
            challenge: new Uint8Array(32),

            rp: { name: "Débita+" },

            user: {
                id: new Uint8Array(16),
                name: "user@example.com",
                displayName: "Débita+ User"
            },

            pubKeyCredParams: [
                { type: "public-key", alg: -7 },     // ES256
                { type: "public-key", alg: -257 }    // RS256
            ],

            authenticatorSelection: {
                authenticatorAttachment: "platform",
                userVerification: "required"
            },

            timeout: 60000,
            attestation: "none"
        }
    });
}


// Verificar biometria
async function verifyBiometric() {
    return await navigator.credentials.get({
        publicKey: {
            challenge: new Uint8Array(32),
            timeout: 60000,
            userVerification: "required"
        }
    });
}


// Ativar biometria
document.getElementById("enable-biometric").addEventListener("click", async () => {
    try {
        await createBiometricKey();

        localStorage.setItem("biometric_enabled", "yes");

        alert("Biometria ativada com sucesso!");

        document.getElementById("biometric-modal").classList.add("hidden");

    } catch (e) {
        alert("Biometria não pôde ser habilitada.");
        console.error(e);
    }
});


// Fechar modal
document.getElementById("close-bio").addEventListener("click", () => {
    document.getElementById("biometric-modal").classList.add("hidden");
});


document.getElementById("enable-biometric").addEventListener("click", async () => {
    try {
        await createBiometricKey();
        localStorage.setItem("biometric_enabled", "yes");
        showToast("Biometria ativada com sucesso!");
        document.getElementById("biometric-modal").classList.add("hidden");
    } catch (e) {
        showToast("Biometria não pôde ser habilitada.", "danger");
    }
});

document.getElementById("close-bio").addEventListener("click", () => {
    document.getElementById("biometric-modal").classList.add("hidden");
});

if (localStorage.getItem("biometric_enabled") === "yes") {
    verifyBiometric()
    .then(() => {
        document.getElementById("dashboard").classList.remove("hidden");
    })
    .catch(() => {
        showToast("Biometria falhou. Acesso negado.", "danger");
    });
} else {
    // pergunta ao usuário se quer ativar biometria
    setTimeout(() => {
        document.getElementById("biometric-modal").classList.remove("hidden");
    }, 700);
}

if (!window.PublicKeyCredential) {
    console.warn("Biometria não suportada");
} else {
    document.getElementById("biometric-modal").classList.remove("hidden");
}
