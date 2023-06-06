import actions from '@cocreate/actions'

let inputs = new Map();

function handleFileInputChange(event) {
    const input = event.target;
    const files = input.files;
    let selected = inputs.get(input) || []
    selected.push(...files)
    inputs.set(input, selected);
    console.log("Files selected:", files);
}

async function selectFile(event) {
    event.preventDefault()
    const input = event.target;
    let selected = inputs.get(input) || []
    try {
        const multiple = input.multiple
        const selectedFiles = await window.showOpenFilePicker({ multiple });

        for (const handle of selectedFiles) {
            selected.push(handle)
        }

        if (selected.length) {
            inputs.set(input, selected);
            console.log("Files selected:", selected);
        }

    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error("Error selecting files:", error);
        }
    }
}

async function selectDirectory(event) {
    event.preventDefault()
    const input = event.target;
    let selected = inputs.get(input) || []

    try {
        const multiple = input.multiple
        const handle = await window.showDirectoryPicker();
        selected.push(handle)

        if (selected.length) {
            inputs.set(input, selected);
            console.log("Directory selected:", selected);
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error("Error selecting directory:", error);
        }
    }
}

async function getNewFileHandle() {
    // const options = {
    //     types: [
    //         {
    //             description: 'Text Files',
    //             accept: {
    //                 'text/plain': ['.txt'],
    //             },
    //         },
    //     ],
    // };
    const handle = await window.showSaveFilePicker(options);
    return handle;
}

async function generateFileObjects(fileInputs, isObject) {
    const files = [];

    if (!Array.isArray(fileInputs))
        fileInputs = [fileInputs]

    for (let input of fileInputs) {
        const selected = inputs.get(input) || []

        for (let i = 0; i < selected.length; i++) {
            let file
            if (selected[i] instanceof FileSystemDirectoryHandle) {
                // The object is an instance of FileSystemFileHandle
                const handles = await getFilesFromDirectory(selected[i], selected[i].name)
                for (let handle of handles) {
                    file = await handle.getFile();
                    file.directory = handle.directory
                    file.parentDirectory = handle.parentDirectory
                    file.path = handle.path

                    if (isObject)
                        files.push(await createFileObject(file))
                    else
                        files.push(file)
                }
            } else {
                if (selected[i] instanceof FileSystemFileHandle) {
                    // The object is an instance of FileSystemFileHandle
                    file = await selected[i].getFile();
                } else {
                    // The object is not an instance of FileSystemFileHandle
                    console.log("It's not a FileSystemFileHandle object");
                    file = selected[i]
                }
                const fileUrl = URL.createObjectURL(file);
                console.log(fileUrl);
                if (isObject = true)
                    files.push(await createFileObject(file))
                else
                    files.push(file)
            }

        }
    }

    return files
}

async function getFilesFromDirectory(handle, name) {
    let files = [];
    for await (const entry of handle.values()) {
        if (entry.kind === 'file') {
            entry.directory = '/' + name
            entry.parentDirectory = name.split("/").pop();
            entry.path = '/' + name + '/' + entry.name
            if (!entry.webkitRelativePath)
                entry.webkitRelativePath = name

            files.push(entry);
        } else if (entry.kind === 'directory') {
            const entries = await getFilesFromDirectory(entry, name + '/' + entry.name);
            files = files.concat(entries);
        }
    }
    return files;
}

// This function creates a file object from the given file 
function createFileObject(file) {
    // Return a new promise that resolves the file object
    return new Promise((resolve) => {
        // Create a FileReader instance to read the file
        const reader = new FileReader();
        // Split the file type into an array
        const fileType = file.type.split('/');
        let readAs;

        // Check if the file type is an image
        if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(fileType[1])
            || fileType[0] === 'image') {
            readAs = 'readAsDataURL';
        }
        // Check if the file type is a video
        else if (['mp4', 'avi', 'mov', 'mpeg', 'flv'].includes(fileType[1])
            || fileType[0] === 'video') {
            readAs = 'readAsDataURL';
        }
        // Check if the file type is an audio
        else if (['mp3', 'wav', 'wma', 'aac', 'ogg'].includes(fileType[1])
            || fileType[0] === 'audio') { // updated condition
            readAs = 'readAsDataURL';
        }
        // Check if the file type is a pdf
        else if (fileType[1] === 'pdf') {
            readAs = 'readAsDataURL';
        }
        // Check if the file type is a document
        else if (['doc', 'msword', 'docx', 'xlsx', 'pptx'].includes(fileType[1])) {
            readAs = 'readAsBinaryString';
        }
        // Otherwise, assume the file type is text
        else {
            readAs = 'readAsText';
        }

        // Read the file based on the file type
        reader[readAs](file);
        // When the file is loaded, resolve the file object
        reader.onload = () => {
            let src = reader.result;
            // If the file type is a document, convert it to base64 encoding
            if (['doc', 'msword', 'docx', 'xlsx', 'pptx'].includes(fileType)) {
                src = btoa(src);
            }

            // Resolve the file object
            resolve({
                name: file.name,
                path: file.path,
                src,
                directory: file.directory,
                parentDirectory: file.parentDirectory,
                size: file.size,
                "content-type": file.type,
                lastModified: file.lastModified,
                lastModifiedDate: file.lastModifiedDate,
                modified: { on: file.lastModifiedDate, by: "unknown" },
                public: "true"
            });
        };
    });
}

const fileInputs = document.querySelectorAll('input[type="file"]')

for (let i = 0; i < fileInputs.length; i++) {
    if (fileInputs[i].hasAttribute('directory')) {
        if (window.showDirectoryPicker)
            fileInputs[i].addEventListener("click", selectDirectory);
        else if ('webkitdirectory' in fileInputs[i]) {
            fileInputs[i].webkitdirectory = true
            fileInputs[i].addEventListener("change", handleFileInputChange)
        } else
            console.error("Directory selection not supported in this browser.");
    } else if (window.showOpenFilePicker)
        fileInputs[i].addEventListener("click", selectFile);
    else
        fileInputs[i].addEventListener("change", handleFileInputChange);

}

async function fileAction(btn, params, action) {
    const form = btn.closest('form')
    let inputs = form.querySelectorAll('input[type="file"]')
    let fileObjects = await generateFileObjects(Array.from(inputs), true)

    console.log('fileObjects', fileObjects)
    document.dispatchEvent(new CustomEvent(action, {
        detail: {}
    }));

}

async function getFiles(inputs) {
    let files = await generateFileObjects(fileInputs)
    return files
}
async function getObjects(inputs) {
    let objects = await generateFileObjects(fileInputs, true)
    return objects
}

actions.init({
    name: "uploadFiles",
    callback: (btn, params) => {
        fileAction(btn, params, "uploadFiles")
    }
})

export default { getFiles, getObjects }