

export function injectSharedUI() {
    // 1. Inject Styles for the spinner
    if (!document.getElementById("shared-ui-styles")) {
        const style = document.createElement("style");
        style.id = "shared-ui-styles";
        style.innerHTML = `
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            .spinner { 
                width:50px; height:50px; border:5px solid #f3f3f3; 
                border-top:5px solid #3b82f6; border-radius:50%; 
                animation:spin 1s linear infinite; 
            }
        `;
        document.head.appendChild(style);
    }

    // 2. Inject Loading Overlay
    if (!document.getElementById("loading-overlay")) {
        const loader = document.createElement("div");
        loader.id = "loading-overlay";
        loader.style = "display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(255,255,255,0.8); z-index:9999; flex-direction:column; align-items:center; justify-content:center;";
        loader.innerHTML = `
            <div class="spinner"></div>
            <p style="margin-top:15px; font-family:sans-serif; color:#3b82f6; font-weight:bold;">Fetching Data...</p>
        `;
        document.body.appendChild(loader);
    }

}

// Global helper to toggle the loader
window.toggleLoading = (show) => {
    const loader = document.getElementById("loading-overlay");
    if (loader) loader.style.display = show ? "flex" : "none";
};