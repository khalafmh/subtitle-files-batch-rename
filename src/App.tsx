import React, {useState} from 'react'
import {
    AppBar,
    Box,
    Button,
    createTheme,
    CssBaseline,
    Paper,
    TextField,
    Theme,
    ThemeProvider,
    Toolbar,
    Typography
} from "@mui/material";

declare global {
    interface Window {
        showDirectoryPicker: () => FileSystemDirectoryHandle,
    }

    interface FileSystemDirectoryHandle {
        keys: () => AsyncIterable<string>
    }
}

const styles = {
    body: {
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        p: "10px",
        alignSelf: "center",
        width: "100%",
        maxWidth: "900px",
    },
    fieldGroup: {
        display: "flex",
        alignItems: "center",
    },
    fileList: {
        display: "flex",
        flexDirection: "column",
        alignItems: "start",
        gap: "5px",
        p: "10px",
    },
}

const theme: Theme = createTheme({
    components: {
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundColor: "#f0f0f0"
                },
            },
        },
    },
})

const FileCard = (props: any) => (
    <Paper variant="outlined" sx={{backgroundColor: "#dddddd", p: "10px"}}>
        {props.children}
    </Paper>
)

const FileList = (props: { files: Array<string> }) => (
    <Paper sx={styles.fileList}>
        {props.files.map(fileName => (
            <FileCard key={fileName}>{fileName}</FileCard>
        ))}
    </Paper>
)

function deriveSubtitleFileName(
    episodeFileName: string,
    episodeFileExtension: string,
    subtitleFileExtension: string,
) {
    const episodeFileNameWithoutExtension = episodeFileName.substring(0, episodeFileName.length - `.${episodeFileExtension}`.length)
    return `${episodeFileNameWithoutExtension}.${subtitleFileExtension}`
}

function extensionWithoutDot(s: string): string {
    return /\.?(?<value>[^.]+)/.exec(s)?.groups?.value ?? s
}

function App() {
    const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null)
    const [files, setFiles] = useState<Array<string>>([])
    const [episodeExtensionInput, setEpisodeExtensionInput] = useState("")
    const [subtitleExtensionInput, setSubtitleExtensionInput] = useState("")
    const [episodeNumberPattern, setEpisodeNumberPattern] = useState("")
    const [subtitleNumberPattern, setSubtitleNumberPattern] = useState("")

    const episodeExtension = extensionWithoutDot(episodeExtensionInput)
    const subtitleExtension = extensionWithoutDot(subtitleExtensionInput)

    function nameAndEpisode(name: string, pattern: string): [number | undefined, string] {
        try {
            const regExp = new RegExp(pattern);
            const episodeString = regExp.exec(name)?.groups?.value;
            return [episodeString != null ? parseInt(episodeString) : undefined, name];
        } catch (err) {
            return [undefined, name]
        }
    }

    const episodeFiles: Array<[number | undefined, string]> = files
        .filter(name => name.endsWith(episodeExtension))
        .map(name => nameAndEpisode(name, episodeNumberPattern))
    const subtitleFiles: Array<[number | undefined, string]> = files
        .filter(name => name.endsWith(subtitleExtension))
        .map(name => nameAndEpisode(name, subtitleNumberPattern))
    const subtitleFilesByEpisode = Object.fromEntries(subtitleFiles.filter(([episode]) => episode != null))
    const episodeFilesWithMatchingSubtitles: Array<[number, string]> = episodeFiles
        .filter(([episode]) => episode != null && subtitleFilesByEpisode[episode] != null) as Array<[number, string]>;

    const onConfirmOperation = async () => {
        if (episodeFilesWithMatchingSubtitles.length === 0) {
            alert("No files were matched. Aborting.")
            return
        }
        const job = episodeFilesWithMatchingSubtitles.map(async ([episode, fileName]) => {
            const subtitleFileName = subtitleFilesByEpisode[episode];
            const resultFileName = deriveSubtitleFileName(fileName, episodeExtension, subtitleExtension);
            if (subtitleFileName === resultFileName) {
                return
            }

            const existingFile: File | undefined = await dirHandle?.getFileHandle(subtitleFileName)
                ?.then(handle => handle.getFile());
            if (existingFile == null) {
                alert(`Error: file ${subtitleFileName} could not be read from the directory`)
                return
            }
            try {
                await dirHandle?.getFileHandle(resultFileName);
                alert(`Subtitle file "${subtitleFileName}" was not renamed because the operation would overwrite an existing file with the name "${resultFileName}"`)
                return
            } catch (err) {
                // pass
            }
            const outputFileStream: any = await dirHandle?.getFileHandle(resultFileName, {create: true})
                .then(handle => (handle as any).createWritable())
            await outputFileStream.write(await existingFile.arrayBuffer())
            await outputFileStream.close()
            await dirHandle?.removeEntry(subtitleFileName)
        });
        for await (const item of job) {
        }
        alert("Finished")
    }

    return (
        <ThemeProvider theme={theme}>
            <Box sx={{display: "flex", flexDirection: "column"}}>
                <CssBaseline/>
                <AppBar variant="elevation" position="sticky">
                    <Toolbar variant="dense">
                        Batch Subtitle Renamer
                    </Toolbar>
                </AppBar>
                <Box sx={styles.body}>
                    <Box sx={styles.fieldGroup}>
                        <TextField
                            variant="outlined"
                            fullWidth
                            disabled
                            label="Directory"
                            value={dirHandle?.name ?? ""}
                        />
                        <Button
                            variant="outlined"
                            onClick={async () => {
                                try {
                                    const result: FileSystemDirectoryHandle = await window.showDirectoryPicker()
                                    if (result == null) return
                                    setDirHandle(result)
                                    const files: Array<string> = []
                                    for await (const fileName of result.keys()) {
                                        files.push(fileName)
                                    }
                                    setFiles(files)
                                } catch (err) {
                                    alert("Directory selection canceled")
                                }
                            }}
                        >
                            ...
                        </Button>
                    </Box>
                    <Typography>Directory Files</Typography>
                    <FileList files={files}/>
                    {
                        [
                            ["Episode File Extension", episodeExtensionInput, setEpisodeExtensionInput],
                            ["Subtitle File Extension", subtitleExtensionInput, setSubtitleExtensionInput],
                            ["Episode Number Regex for Episode Files", episodeNumberPattern, setEpisodeNumberPattern],
                            ["Episode Number Regex for Subtitle Files", subtitleNumberPattern, setSubtitleNumberPattern],
                        ].map(([label, value, setValue]: any) => (
                            <TextField
                                key={label}
                                variant="outlined"
                                label={label}
                                value={value}
                                onChange={e => setValue(e.target.value)}
                            />
                        ))
                    }
                    <Typography>Episode Files</Typography>
                    <FileList files={episodeFiles.map(([episode, fileName]) => `${episode}: ${fileName}`)}/>
                    <Typography>Subtitle Files</Typography>
                    <FileList files={subtitleFiles.map(([episode, fileName]) => `${episode}: ${fileName}`)}/>
                    <Typography>Matching Files</Typography>
                    <Paper sx={styles.fileList}>
                        {episodeFilesWithMatchingSubtitles.map(([episode, fileName]) => (
                            <FileCard key={fileName}>
                                <Typography>{episode}</Typography>
                                <Typography>{fileName}</Typography>
                                <Typography>{episode && subtitleFilesByEpisode[episode]}</Typography>
                            </FileCard>
                        ))}
                    </Paper>
                    <Typography>Renamed Files</Typography>
                    <Paper sx={styles.fileList}>
                        {episodeFilesWithMatchingSubtitles.map(([episode, fileName]) => (
                                <FileCard key={fileName}>
                                    <Typography>{episode}</Typography>
                                    <Typography>{fileName}</Typography>
                                    <Typography>{episode && subtitleFilesByEpisode[episode] && deriveSubtitleFileName(fileName, episodeExtension, subtitleExtension)}</Typography>
                                </FileCard>
                            ))}
                    </Paper>
                    <Button
                        variant="contained"
                        onClick={onConfirmOperation}
                        sx={{width: "fit-content", alignSelf: "start"}}
                    >
                        Confirm
                    </Button>
                </Box>
            </Box>
        </ThemeProvider>
    )
}

export default App
