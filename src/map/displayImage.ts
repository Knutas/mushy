export function displayImage(imageUrl: string) {
  const dialog = L.DomUtil.create("dialog", "image-dialog", document.body);

  const img = L.DomUtil.create("img", undefined, dialog);
  img.src = imageUrl;

  dialog.addEventListener("click", () => dialog.close());

  dialog.addEventListener("close", () => dialog.remove());

  dialog.showModal();
}
