const input = document.getElementById("file-selector");
const fileLabel = document.getElementById("file-selector-label");
const fileText = document.getElementById("file-selector-text");
const isSelected = document.getElementById("is-image-selected");
const selectedImage = document.getElementById("selected-image");
const encryptButton = document.getElementById("encrypt-button");
const keyLabel = document.getElementById("encrypt-key-text");
const keyInput = document.getElementById("decrypt-key-input");
const copyButton = document.getElementById("copy");
const encrypterButton = document.getElementById("select-encrypt-button");
const decrypterButton = document.getElementById("select-decrypt-button");
const progressContainer = document.getElementById("progress-container");
const progressBar = document.getElementById("progress-bar");
let currentFile;
let mode = "encrypter";
const updateProgress = (percent) => {
  progressContainer.style.display = "block";
  progressBar.style.width = percent + "%";
  if (percent >= 100) {
    setTimeout(() => {
      progressContainer.style.display = "none";
      progressBar.style.width = "0%";
    }, 600);
  }
};
const handleFileSelection = (file) => {
  if (!file) return;
  if (mode === "encrypter") {
    if (!file.type.startsWith("image/")) {
      encryptButton.textContent = "Only images allowed!";
      input.value = "";
      currentFile = null;
      isSelected.style.display = "none";
      setTimeout(() => { encryptButton.textContent = "Encrypt"; }, 3000);
      return;
    }
    currentFile = file;
    document.getElementById("is-image-selected-text").textContent = "Image is selected!";
    isSelected.style.display = "flex";
    const url = URL.createObjectURL(file);
    selectedImage.src = url;
    selectedImage.hidden = false;
  } else {
    if (!file.name.endsWith(".enc")) {
      encryptButton.textContent = "Only .enc files allowed!";
      input.value = "";
      currentFile = null;
      isSelected.style.display = "none";
      setTimeout(() => { encryptButton.textContent = "Decrypt"; }, 3000);
      return;
    }
    currentFile = file;
    document.getElementById("is-image-selected-text").textContent = "Encrypted file loaded!";
    isSelected.style.display = "flex";
    selectedImage.hidden = true;
  }
};
input.addEventListener("change", (event) => {
  if (event.target.files.length > 0) {
    handleFileSelection(event.target.files[0]);
  }
});
fileLabel.addEventListener("dragover", (event) => {
  event.preventDefault();
  fileLabel.classList.add("dragover");
});
fileLabel.addEventListener("dragleave", () => {
  fileLabel.classList.remove("dragover");
});
fileLabel.addEventListener("drop", (event) => {
  event.preventDefault();
  fileLabel.classList.remove("dragover");
  if (event.dataTransfer.files.length > 0) {
    handleFileSelection(event.dataTransfer.files[0]);
  }
});
const createKey = async () => {
  const cryptoKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const rawKey = await window.crypto.subtle.exportKey("raw", cryptoKey);
  return {
    cryptoKey,
    keyHexString: Array.from(new Uint8Array(rawKey)).map(b => b.toString(16).padStart(2, "0")).join("")
  };
};
const readFileWithProgress = (file, onProgress) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 50);
        onProgress(percent);
      }
    };
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};
const encryptImage = async (imageFile, cryptoKey) => {
  const arrayBuffer = await readFileWithProgress(imageFile, updateProgress);
  updateProgress(60);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuffer = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, cryptoKey, arrayBuffer);
  updateProgress(80);
  const combinedArray = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combinedArray.set(iv, 0);
  combinedArray.set(new Uint8Array(encryptedBuffer), iv.length);
  const blob = new Blob([combinedArray], { type: "application/octet-stream" });
  const fileUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = fileUrl;
  downloadLink.download = imageFile.name + ".enc";
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(fileUrl);
  updateProgress(100);
};
const decryptImage = async (encryptedFile, hexKeyString) => {
  try {
    const keyArray = new Uint8Array(hexKeyString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const cryptoKey = await window.crypto.subtle.importKey("raw", keyArray, { name: "AES-GCM" }, true, ["decrypt"]);
    const arrayBuffer = await readFileWithProgress(encryptedFile, updateProgress);
    updateProgress(60);
    const iv = arrayBuffer.slice(0, 12);
    const encryptedData = arrayBuffer.slice(12);
    const decryptedBuffer = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(iv) }, cryptoKey, encryptedData);
    updateProgress(80);
    const blob = new Blob([decryptedBuffer], { type: "image/png" });
    const fileUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = fileUrl;
    downloadLink.download = encryptedFile.name.replace(".enc", "") || "decrypted_image.png";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(fileUrl);
    updateProgress(100);
    return true;
  } catch (e) {
    updateProgress(100);
    return false;
  }
};
encryptButton.addEventListener("click", async () => {
  if (!currentFile) {
    encryptButton.textContent = mode === "encrypter" ? "Image isn't selected!" : "File isn't selected!";
    setTimeout(() => { encryptButton.textContent = mode === "encrypter" ? "Encrypt" : "Decrypt"; }, 3000);
    return;
  }
  if (mode === "encrypter") {
    const key = await createKey();
    await encryptImage(currentFile, key.cryptoKey);
    keyLabel.textContent = key.keyHexString;
    keyLabel.classList.add("filled");
  } else {
    const hexKey = keyInput.value.trim();
    if (!hexKey) {
      encryptButton.textContent = "Enter the key!";
      setTimeout(() => { encryptButton.textContent = "Decrypt"; }, 2000);
      return;
    }
    encryptButton.textContent = "Decrypting...";
    const success = await decryptImage(currentFile, hexKey);
    if (success) {
      encryptButton.textContent = "Success!";
    } else {
      encryptButton.textContent = "Invalid Key or File!";
    }
    setTimeout(() => { encryptButton.textContent = "Decrypt"; }, 3000);
  }
});
const flash = state => {
  copyButton.classList.add("clicked");
  setTimeout(() => {
    copyButton.dataset.state = state;
    copyButton.classList.remove("clicked");
  }, 150);
  setTimeout(() => {
    copyButton.dataset.state = "copy";
  }, 1000);
};
copyButton.addEventListener("click", () => {
  if (mode === "decrypter") return;
  const key = keyLabel.textContent.trim();
  if (key.toLowerCase() === "your key") {
    flash("bad");
    return;
  }
  navigator.clipboard.writeText(key).then(() => flash("ok")).catch(() => flash("bad"));
});
const switchMode = (newMode) => {
  if (mode === newMode) return;
  mode = newMode;
  currentFile = null;
  isSelected.style.display = "none";
  selectedImage.src = "";
  input.value = "";
  const elementsToAnimate = [fileText, keyLabel, keyInput, encryptButton, copyButton];
  elementsToAnimate.forEach(el => el.classList.add("move_right"));
  setTimeout(() => {
    if (mode === "encrypter") {
      encrypterButton.classList.add("active");
      decrypterButton.classList.remove("active");
      fileText.textContent = "Select image";
      input.setAttribute("accept", "image/*");
      keyLabel.style.display = "block";
      keyInput.style.display = "none";
      copyButton.style.display = "grid";
      encryptButton.textContent = "Encrypt";
    } else {
      decrypterButton.classList.add("active");
      encrypterButton.classList.remove("active");
      fileText.textContent = "Select .enc file";
      input.setAttribute("accept", ".enc");
      keyLabel.style.display = "none";
      keyInput.style.display = "block";
      keyInput.value = "";
      copyButton.style.display = "none";
      encryptButton.textContent = "Decrypt";
    }
    elementsToAnimate.forEach(el => el.classList.remove("move_right"));
  }, 300);
};
encrypterButton.addEventListener("click", () => switchMode("encrypter"));
decrypterButton.addEventListener("click", () => switchMode("decrypter"));
switchMode("encrypter");
input.setAttribute("accept", "image/*");
