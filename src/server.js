const crud = require("@cocreate/crud-client");
const Config = require("@cocreate/config");
const fs = require("fs");
const realpathAsync = fs.promises.realpath;

const path = require("path");
const mimeTypes = {
	".aac": "audio/aac",
	".abw": "application/x-abiword",
	".arc": "application/x-freearc",
	".avi": "video/x-msvideo",
	".azw": "application/vnd.amazon.ebook",
	".bin": "application/octet-stream",
	".bmp": "image/bmp",
	".bz": "application/x-bzip",
	".bz2": "application/x-bzip2",
	".csh": "application/x-csh",
	".css": "text/css",
	".csv": "text/csv",
	".doc": "application/msword",
	".docx":
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	".eot": "application/vnd.ms-fontobject",
	".epub": "application/epub+zip",
	".gif": "image/gif",
	".htm": "text/html",
	".html": "text/html",
	".ico": "image/x-icon",
	".ics": "text/calendar",
	".jar": "application/java-archive",
	".jpeg": "image/jpeg",
	".jpg": "image/jpeg",
	".js": "text/javascript",
	".json": "application/json",
	".jsonld": "application/ld+json",
	".mid": "audio/midi",
	".midi": "audio/midi",
	".mjs": "text/javascript",
	".mp3": "audio/mpeg",
	".mp4": "video/mp4",
	".mpeg": "video/mpeg",
	".mpkg": "application/vnd.apple.installer+xml",
	".odp": "application/vnd.oasis.opendocument.presentation",
	".ods": "application/vnd.oasis.opendocument.spreadsheet",
	".odt": "application/vnd.oasis.opendocument.text",
	".oga": "audio/ogg",
	".ogv": "video/ogg",
	".ogx": "application/ogg",
	".otf": "font/otf",
	".png": "image/png",
	".pdf": "application/pdf",
	".ppt": "application/vnd.ms-powerpoint",
	".pptx":
		"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	".rar": "application/x-rar-compressed",
	".rtf": "application/rtf",
	".sh": "application/x-sh",
	".svg": "image/svg+xml",
	".swf": "application/x-shockwave-flash",
	".tar": "application/x-tar",
	".tif": "image/tiff",
	".tiff": "image/tiff",
	".ts": "video/mp2t",
	".ttf": "font/ttf",
	".txt": "text/plain",
	".vsd": "application/vnd.visio",
	".wav": "audio/wav",
	".weba": "audio/webm",
	".webm": "video/webm",
	".webmanifest": "application/manifest+json",
	".webp": "image/webp",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".xhtml": "application/xhtml+xml",
	".xls": "application/vnd.ms-excel",
	".xlsx":
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	".xml": "application/xml",
	".xul": "application/vnd.mozilla.xul+xml",
	".zip": "application/zip",
	".3gp": "video/3gpp",
	".3g2": "video/3gpp2",
	".7z": "application/x-7z-compressed"
};

module.exports = async function file(
	CoCreateConfig,
	configPath,
	match,
	options
) {
	let directories = CoCreateConfig.directories;
	let sources = CoCreateConfig.sources;
	let configDirectoryPath = path.dirname(configPath);

	if (match && !Array.isArray(match)) {
		match = [match];
	} else if (!match) {
		match = [];
	}

	let config = await Config(
		{
			organization_id: {
				prompt: "Enter your organization_id: "
			},
			host: {
				prompt: "Enter the host: "
			},
			prompt: {
				prompt: "Choose an authentication option: \n1.apikey\n2.Sign In\n",
				choices: {
					1: {
						apikey: {
							prompt: "Enter your apikey: "
						}
					},
					2: {
						email: {
							prompt: "Enter your email: "
						},
						password: {
							prompt: "Enter your password: "
						}
					}
				}
			}
		},
		null,
		null,
		configPath
	);

	if (
		!config.organization_id ||
		(!config.apikey && (!config.password || config.email))
	) {
		console.log("One or more required config params could not be found");
		process.exit();
	}

	if (config.email && config.password) {
		let request = {
			method: "signIn",
			array: "users",
			$filter: {
				query: {
					email: config.email,
					password: config.password
				}
			},
			...config
		};

		let response = await crud.send(request);
		let { success, token } = response;

		if (success) {
			console.log("succesful sign in");
			// apply token to socket
		} else {
			console.log("The email or password you entered is incorrect");
			process.exit();
		}
	}

	// console.log('Uploading files...')

	/**
	 * Store files by config directories
	 **/
	let errorLog = [];

	async function runDirectories() {
		for (const directory of directories) {
			const entry = directory.entry;
			const exclude = directory.exclude || [];
			await runFiles(directory, entry, exclude);
		}
		return;
	}

	async function runFiles(directory, entry, exclude, Path, directoryName) {
		const entryPath = path.resolve(configDirectoryPath, entry);
		let files = fs.readdirSync(entryPath);

		for (let file of files) {
			let skip = false;
			for (let i = 0; i < exclude.length; i++) {
				if (file.includes(exclude[i])) {
					skip = true;
					break;
				}
			}
			if (skip) continue;

			let isDirectory;
			let isSymlink = fs
				.lstatSync(`${entryPath}/${file}`)
				.isSymbolicLink();
			if (isSymlink) {
				let symlinkPath = await realpathAsync(`${entryPath}/${file}`);
				isDirectory =
					fs.existsSync(symlinkPath) &&
					fs.lstatSync(symlinkPath).isDirectory();
			} else
				isDirectory =
					fs.existsSync(`${entryPath}/${file}`) &&
					fs.lstatSync(`${entryPath}/${file}`).isDirectory();

			let name = file;
			let source = "";

			for (let i = 0; i < match.length; i++) {
				skip = true;
				const filePath = path.resolve(entryPath, file);
				if (filePath.startsWith(match[i])) {
					skip = false;
					break;
				} else if (isDirectory && match[i].startsWith(filePath)) {
					skip = "directory";
					break;
				}
			}

			if (skip === true) continue;

			const fileExtension = path.extname(file);
			let mimeType = mimeTypes[fileExtension];

			if (!directoryName) {
				if (directory.object && directory.object.directory) {
					if (directory.object.directory === "{{directory}}") {
						directoryName = entry.split("/");
						directoryName = directoryName[directoryName.length - 1];
					} else directoryName = directory.object.directory;
				} else directoryName = "/";
			}

			if (exclude && exclude.includes(directoryName)) continue;

			if (!Path) {
				if (directoryName === "/") Path = directoryName;
				else Path = "/" + directoryName;
			}

			let pathname;
			if (Path === "/") pathname = Path + name;
			else pathname = Path + "/" + name;

			if (isDirectory) mimeType = "text/directory";
			else
				source = await getSource(
					`${entryPath}/${file}`,
					mimeType,
					isSymlink
				);

			let values = {
				"{{name}}": name || "",
				"{{source}}": Buffer.isBuffer(source) ? `data:${mimeType};base64,${source.toString('base64')}` : source || "",
				"{{directory}}": directoryName || "",
				"{{path}}": Path || "",
				"{{pathname}}": pathname,
				"{{content-type}}": mimeType || ""
			};

			let object = { ...directory.object };
			if (!object.name) object.name = "{{name}}";
			if (!object.src) object.src = "{{source}}";
			if (!object.directory) object.directory = "{{directory}}";
			if (!object.path) object.path = "{{path}}";
			if (!object.pathname) object.pathname = "{{pathname}}";
			if (!object["content-type"])
				object["content-type"] = "{{content-type}}";
			if (
				!object.public &&
				object.public != false &&
				object.public != "false"
			)
				object.public = "true";

			let newObject = {
				array: directory.array || "files",
				object
			};

			if (
				options.translate &&
				mimeType === "text/html" &&
				Array.isArray(directory.languages) &&
				!object.translations
			) {
				try {
					// Call your AI translation service
					const translations = await options.translate(
						Buffer.isBuffer(source) ? source.toString('utf-8') : source,
						directory.languages
					);
					newObject.object.translations = translations;
				} catch (err) {
					console.error("Translation error:", err);
					// Continue without translations
				}
			}

			if (directory.storage) newObject.storage = directory.storage;
			if (directory.database) newObject.database = directory.database;
			if (directory.array) newObject.array = directory.array || "files";

			for (const key of Object.keys(directory.object)) {
				if (typeof directory.object[key] == "string") {
					let variables = directory.object[key].match(
						/{{([A-Za-z0-9_.,\[\]\-\/ ]*)}}/g
					);
					if (variables) {
						for (let variable of variables) {
							let replacement = values[variable];
							if (key === 'src' && variable === '{{source}}' && Buffer.isBuffer(source)) {
								replacement = `data:${mimeType};base64,${source.toString('base64')}`;
							}
							newObject.object[key] = newObject.object[
								key
							].replace(variable, replacement);
						}
					}
				}
			}

			if (skip !== "directory") {
				if (!newObject.object._id)
					newObject.$filter = {
						query: {
							pathname
						}
					};

				response = await runStore(newObject);
				console.log(
					`Uploaded: ${entryPath}/${file}`,
					`To: ${pathname}`
				);

				if (response.error) errorLog.push(response.error);
			}

			if (isDirectory && pathname) {
				let newEntry;
				if (entry.endsWith("/")) newEntry = entry + name;
				else newEntry = entry + "/" + name;

				await runFiles(directory, newEntry, exclude, pathname, name);
			}
		}
		// if (errorLog.length)
		//     console.log(...errorLog)
	}

	async function getSource(filePath, mimeType, isSymlink) {
		// 1. UPDATED: Includes standard font types and uses simpler matching
		const base64MimeTypes = /^(image|audio|video|font\/(woff2?|ttf|otf|eot)|application\/vnd\.ms-fontobject|application\/x-font-.*|application\/octet-stream)/;

		// We only care if it needs to be Base64-encoded for a Data URI.
		const needsBase64 = base64MimeTypes.test(mimeType);

		let resolvedPath = filePath;
		if (isSymlink) {
			// Use promises for realpath
			resolvedPath = await realpathAsync(filePath);
		}

		// 2. READ: Always read the file as a raw Buffer (omitting encoding)
		// This gives us the raw bytes, which is the safest start for any file.
		let fileBuffer;
		try {
			fileBuffer = await fs.promises.readFile(resolvedPath);
		} catch (error) {
			console.error(`Error reading file: ${resolvedPath}`, error);
			return ""; // Return empty string or handle error as appropriate
		}

		if (needsBase64) {
			// 3. RETURN BUFFER: Return the raw buffer for binary files.
			return fileBuffer;
		} else {
			// 4. HANDLE TEXT/OTHER:
			// For files not intended for Base64, convert the Buffer to a string using 'utf8'.
			return fileBuffer.toString('utf8');
		}
	}

	/**
	 * Store files by config sources
	 **/
	async function runSources() {
		let newConfig = require(configPath);

		for (let i = 0; i < sources.length; i++) {
			let data = sources[i];

			// Handle string values
			if (typeof data === "string") {
				let {value, filePath } = await processVariables(data);
				let response = await runStore(value);
				if (response && response.object && response.object[0]) {
					updateFilePath(filePath, response); // Call the new function to update the file path
				}
			} else if (data.array && data.object) {
				if (typeof data.object === "string") {
					let {value, filePath } = await processVariables(data.object);
					if (value) {
						let response = await runStore(value);
						if (response && response.object && response.object[0]) {
							updateFilePath(filePath, response.object);
						}
					}
				} else if (typeof data.object === "object" && data.object !== null) {
					for (const key in data) {
						let {value } = await processVariables(data[key]);
						if (data) {
							data.object[key] = value;
						}
					}
					let response = await runStore(data);
					if (response && response.object && response.object[0] && response.object[0]._id) {
						newConfig.sources[i].object._id = response.object[0]._id;
					}
				}
			}

		}

		return newConfig;
	}

	async function processVariables(value) {
		let variableMatch = /{{\s*([\w\W]+)\s*}}/g.exec(value);
		if (!variableMatch) return { value, filePath: null };

		let entry = variableMatch[1].trim();
		if (!fs.existsSync(entry)) return { value, filePath: null };

		const filePath = path.resolve(configDirectoryPath, entry);

		// Check if the file path matches any of the provided match patterns
		let isMatched = match.some((pattern) => filePath.startsWith(pattern));
		if (!isMatched) return { value, filePath: null };

		// Read the file as is
		let content;
		try {
			const fileMimeType = mimeTypes[path.extname(entry)] || "text/plain";

			if (fileMimeType === "application/json") {
				// Parse JSON files
				content = JSON.parse(fs.readFileSync(filePath, "utf8"));
			} else if (fileMimeType === "application/javascript" || fileMimeType === "text/javascript") {
				// For JavaScript files, require the file to execute exports
				content = require(filePath);
			} else {
				// For plain strings, read as UTF-8 without conversion
				content = fs.readFileSync(filePath, "utf8");
			}
		} catch (error) {
			console.error(`Failed to process file: ${filePath}`, error);
			return { value, filePath: null };
		}

		return { value: content, filePath };
	}

	/**
	 * Updates the file at the given file path with the provided data.
	 * The data is saved as a JSON string.
	 * 
	 * @param {string} filePath - The path of the file to update.
	 * @param {object} data - The data to write to the file.
	 */
	function updateFilePath(filePath, data) {
		try {
			const jsonData = JSON.stringify(data, null, 4); // Format JSON with indentation
			fs.writeFileSync(filePath, jsonData, "utf8");
			console.log(`File updated successfully at: ${filePath}`);
		} catch (error) {
			console.error(`Failed to update file at: ${filePath}`, error);
		}
	}


	async function runStore(data) {
		try {
			let response;
			if (!data.object._id && !data.$filter) {
				response = await crud.send({
					method: "object.create",
					...config,
					...data
				});
			} else {
				response = await crud.send({
					method: "object.update",
					...config,
					...data,
					upsert: true
				});
			}
			if (response) {
				return response;
			}
		} catch (err) {
			console.log(err);
			return null;
		}
	}

	async function run() {
		if (directories) {
			await runDirectories();
		}

		if (sources && sources.length) {
			let newConfig = await runSources();
			fs.writeFileSync(
				configPath,
				`module.exports = ${JSON.stringify(newConfig, null, 4)};`
			);
		}
	}

	await run();
	// Only exit if not in watch mode
	if (!process.argv.includes("--watch") && !process.argv.includes("-w")) {
		process.exit();
	}
};
