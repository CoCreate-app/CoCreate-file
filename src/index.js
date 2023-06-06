import observer from '@cocreate/observer';
import crud from '@cocreate/crud-client';
import action from '@cocreate/actions';
import render from '@cocreate/render';
import '@cocreate/element-prototype';

let inputs = new Map();

function init(elements) {
    // Returns an array of elements.
    if (!elements)
        elements = document.querySelectorAll('[type="file"]')

    // If elements is an array of elements returns an array of elements.
    else if (!Array.isArray(elements))
        elements = [elements]
    for (let i = 0; i < elements.length; i++) {
        if (elements[i].tagName !== 'INPUT') {
            // TODO: create input and append to div if input dos not exist
        }
        elements[i].getValue = async () => await getSelectedFiles([elements[i]], true)

        // elements[i].setValue = (value) => pickr.setColor(value);
        if (elements[i].hasAttribute('directory')) {
            if (window.showDirectoryPicker)
                elements[i].addEventListener("click", selectDirectory);
            else if ('webkitdirectory' in elements[i]) {
                elements[i].webkitdirectory = true
                elements[i].addEventListener("change", handleFileInputChange)
            } else
                console.error("Directory selection not supported in this browser.");
        } else if (window.showOpenFilePicker)
            elements[i].addEventListener("click", selectFile);
        else
            elements[i].addEventListener("change", handleFileInputChange);
    }
}


function handleFileInputChange(event) {
    const input = event.target;
    const files = input.files;
    let selected = inputs.get(input) || []
    selected.push(...files)
    inputs.set(input, selected);
    console.log("Files selected:", files);
    renderFiles(input)
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
            renderFiles(input)
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
        const handle = await window.showDirectoryPicker();
        selected.push(handle)

        if (selected.length) {
            inputs.set(input, selected);
            console.log("Directory selected:", selected);
            renderFiles(input)
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

async function getSelectedFiles(fileInputs, isObject) {
    const files = [];

    if (!Array.isArray(fileInputs))
        fileInputs = [fileInputs]

    for (let input of fileInputs) {
        const selected = inputs.get(input) || []

        for (let i = 0; i < selected.length; i++) {
            let file
            if (selected[i] instanceof FileSystemDirectoryHandle) {
                // The object is an instance of FileSystemFileHandle
                const handles = await getSelectedDirectoryFiles(selected[i], selected[i].name)
                for (let handle of handles) {
                    if (handle.kind === 'file')
                        file = await handle.getFile();
                    else if (handle.kind === 'directory')
                        file = { ...handle, name: handle.name }
                    else continue

                    if (isObject)
                        file = await readFile(file)

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

                if (isObject)
                    file = await readFile(file)

                files.push(file)
            }

        }
    }

    return files
}

async function getSelectedDirectoryFiles(handle, name) {
    let files = [];
    for await (const entry of handle.values()) {
        entry.directory = '/' + name
        entry.parentDirectory = name.split("/").pop();
        entry.path = '/' + name + '/' + entry.name
        if (!entry.webkitRelativePath)
            entry.webkitRelativePath = name

        if (entry.kind === 'file') {
            files.push(entry);
        } else if (entry.kind === 'directory') {
            entry.type = 'text/directory'
            files.push(entry);
            const entries = await getSelectedDirectoryFiles(entry, name + '/' + entry.name);
            files = files.concat(entries);
        }
    }
    return files;
}

// This function reads the file and returns its src
function readFile(file) {
    // Return a new promise that resolves the file object
    return new Promise((resolve) => {
        file["content-type"] = file.type

        // Split the file type into an array
        const fileType = file.type.split('/');
        let readAs;

        // Check if the file type is a directory
        if (fileType[1] === 'directory') {
            return resolve(file)
        }
        // Check if the file type is a image
        else if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(fileType[1])
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

        // Create a FileReader instance to read the file
        const reader = new FileReader();
        // Read the file based on the file type
        reader[readAs](file);
        // When the file is loaded, resolve the file object
        reader.onload = () => {
            file.src = reader.result;
            // If the file type is a document, convert it to base64 encoding
            if (['doc', 'msword', 'docx', 'xlsx', 'pptx'].includes(fileType)) {
                file.src = btoa(file.src);
            }

            // Resolve the file object
            resolve(file);
        };
    });
}

async function fileAction(btn, params, action) {
    const form = btn.closest('form')
    let inputs = form.querySelectorAll('input[type="file"]')
    let fileObjects = await getSelectedFiles(Array.from(inputs), true)

    console.log('fileObjects', fileObjects)
    document.dispatchEvent(new CustomEvent(action, {
        detail: {}
    }));

}

// may be best to use getValue() so form so inputtype files can be can be managed in forms
async function save(inputs, collection, document_id) {
    let files = await getSelectedFiles(inputs, true)

    let response = await crud.updateDocument({
        collection,
        document: files,
        upsert: true
    });

    if (response && (!document_id || document_id !== response.document_id)) {
        crud.setDocumentId(element, collection, response.document_id);
    }

    return response
}

async function getFiles(inputs) {
    let files = await getSelectedFiles(inputs)
    return files
}

async function getObjects(inputs) {
    let objects = await getSelectedFiles(inputs, true)
    return objects
}

function renderFiles(input) {
    // TODO: support 
    let template_id = input.getAttribute('template_id')
    if (template_id) {
        // if data items are handle it will not yet have all the details 
        const data = inputs.get(input)
        if (data.length) return
        render.data({
            selector: `[template='${template_id}']`,
            data
        });
    }
}

observer.init({
    name: 'CoCreateFileAddedNodes',
    observe: ['addedNodes'],
    target: 'input[type="file"]',
    callback: mutation => init(mutation.target)

});

observer.init({
    name: 'CoCreateFileAttributes',
    observe: ['attributes'],
    attributeName: ['type'],
    target: 'input[type="file"]',
    callback: mutation => init(mutation.target)
});

action.init({
    name: "upload",
    callback: (btn, params) => {
        fileAction(btn, params, "upload")
    }
})

init()

export default { getFiles, getObjects }