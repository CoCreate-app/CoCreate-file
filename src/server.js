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

module.exports = async function file(CoCreateConfig, configPath, match) {
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
				if (file.includes(exclude)) {
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
				"{{source}}": source || "",
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
							newObject.object[key] = newObject.object[
								key
							].replace(variable, values[variable]);
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

	async function getSource(path, mimeType, isSymlink) {
		let readType = "utf8";
		if (mimeType === "image/svg+xml") {
			readType = "utf8";
		} else if (/^(image|audio|video)\/[-+.\w]+/.test(mimeType)) {
			readType = "base64";
		}

		if (isSymlink) path = await realpathAsync(path);

		let binary = fs.readFileSync(path);
		let content = new Buffer.from(binary).toString(readType);

		return content;
	}

	/**
	 * Store files by config sources
	 **/
	async function runSources() {
		let updatedSources = [];

		for (let i = 0; i < sources.length; i++) {
			const { array, object } = sources[i];

			let source = { ...sources[i] };
			let keys = new Map();
			let response = {};
			let isMatch = false;

			try {
				if (array) {
					if (!object) object = {};
					else
						for (const key of Object.keys(object)) {
							if (typeof object[key] != "string") continue;

							let variables = object[key].match(
								/{{([A-Za-z0-9_.,\[\]\-\/ ]*)}}/g
							);
							if (variables) {
								let originalValue = object[key];
								keys.set(key, originalValue);
								let value = "";
								for (let variable of variables) {
									let entry = /{{\s*([\w\W]+)\s*}}/g.exec(
										variable
									);
									entry = entry[1].trim();
									if (entry) {
										if (!fs.existsSync(entry)) continue;

										if (!isMatch) {
											const filePath = path.resolve(
												configDirectoryPath,
												entry
											);
											for (
												let i = 0;
												i < match.length;
												i++
											) {
												if (
													filePath.startsWith(
														match[i]
													)
												) {
													console.log(
														"Source saved",
														sources[i]
													);
													isMatch = true;
													break;
												}
											}
										}

										let read_type = "utf8";
										const fileExtension =
											path.extname(entry);
										let mime_type =
											mimeTypes[fileExtension] ||
											"text/html";

										if (
											/^(image|audio|video)\/[-+.\w]+/.test(
												mime_type
											)
										) {
											read_type = "base64";
										}

										let binary = fs.readFileSync(entry);
										let content = new Buffer.from(
											binary
										).toString(read_type);
										if (content) value += content;
										// object[key] = object[key].replace(variable, content);
									}
								}
								object[key] = value;
							}
						}

					let data = { array, object };
					if (!object._id && object.pathname)
						data.$filter = {
							query: {
								$or: [{ pathname: object.pathname }]
							}
						};

					if (match.length && isMatch)
						response = await runStore(data);
				}
			} catch (err) {
				console.log(err);
				process.exit();
			}

			if (
				response.object &&
				response.object[0] &&
				response.object[0]._id
			) {
				source.object._id = response.object[0]._id;
			}

			for (const [key, value] of keys) {
				source.object[key] = value;
			}

			updatedSources.push(source);
		}

		return updatedSources;
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
		if (directories) await runDirectories();

		if (sources && sources.length) {
			let sources = await runSources();
			let newConfig = { ...CoCreateConfig };
			if (directories && directories.length)
				newConfig.directories = directories;

			newConfig.sources = sources;

			if (newConfig.repositories)
				newConfig.repositories.forEach((obj) => {
					for (const key in obj) {
						if (!["path", "repo", "exclude"].includes(key)) {
							delete obj[key];
						}
					}
				});

			delete newConfig.url;
			delete newConfig.broadcast;

			fs.writeFileSync(
				configPath,
				`module.exports = ${JSON.stringify(newConfig, null, 4)};`
			);
		}

		if (!match.length) {
			console.log("upload complete!");

			setTimeout(function () {
				process.exit();
			}, 2000);
		}
	}

	await run();
};
