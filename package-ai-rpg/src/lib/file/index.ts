//Saving data to a file the user downloads, and reading a file the user picks.

/**Gives the data to the user as a file download*/
export function file_save(name: string, data: Blob): void {
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**Lets the user pick a file, undefined when the picker is cancelled
 * @param accept file types to offer, like ".json" or "image/*"*/
export function file_open(accept: string): Promise<File | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0]);
    input.oncancel = () => resolve(undefined);
    input.click();
  });
}
