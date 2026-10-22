console.log('Lets write JavaScript');

let currentSong = new Audio();
let songs = [];
let currFolder;
let currentTrack = "";

const play = document.getElementById("play");
const previous = document.getElementById("previous");
const next = document.getElementById("next");

function secondsToMinutesSeconds(seconds) {
    if (isNaN(seconds) || seconds < 0) {
        return "00:00";
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(remainingSeconds).padStart(2, '0');

    return `${formattedMinutes}:${formattedSeconds}`;
}

// Get all songs from a folder
async function getSongs(folder) {
    currFolder = folder.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");

    const response = await fetch(`/${currFolder}/`);

    if (!response.ok) {
        throw new Error(`Could not load folder: ${currFolder}`);
    }

    const html = await response.text();
    const div = document.createElement("div");
    div.innerHTML = html;

    const anchors = div.getElementsByTagName("a");
    songs = [];

    for (let index = 0; index < anchors.length; index++) {
        const element = anchors[index];

        let path = new URL(element.href).pathname;

        try {
            path = decodeURIComponent(path);
        } catch (error) {
            console.warn("Could not decode file path:", path);
        }

        // Convert Windows backslashes to normal URL slashes
        path = path.replace(/\\/g, "/");

        const fileName = path.split("/").filter(Boolean).pop();

        if (fileName && fileName.toLowerCase().endsWith(".mp3")) {
            songs.push(fileName);
        }
    }

    console.log("Songs found:", songs);

    // Show all songs in the playlist
    const songUL = document.querySelector(".songList ul");

    if (!songUL) {
        console.error("Playlist element .songList ul was not found.");
        return songs;
    }

    songUL.innerHTML = "";

    for (const song of songs) {
        songUL.innerHTML += `
            <li>
                <img class="invert" width="34" src="img/music.svg" alt="">

                <div class="info">
                    <div>${song}</div>
                    <div>Om</div>
                </div>

                <div class="playnow">
                    <span>Play Now</span>
                    <img class="invert" src="img/play.svg" alt="">
                </div>
            </li>
        `;
    }

    // Play the selected song
    Array.from(songUL.getElementsByTagName("li")).forEach((element, index) => {
        element.addEventListener("click", () => {
            playMusic(songs[index]);
        });
    });

    return songs;
}

// Play a song
async function playMusic(track, pause = false) {
    if (!track) {
        console.error("No song available to play.");
        return;
    }

    const trackName = typeof track === "string" ? track : track.name;
    currentTrack = track;

    currentSong.src = typeof track === "string"
        ? `/${currFolder}/${encodeURIComponent(track)}`
        : track.src;
    currentSong.load();

    document.querySelector(".songinfo").textContent = trackName;
    document.querySelector(".songtime").textContent = "00:00 / 00:00";

    if (!pause) {
        try {
            await currentSong.play();
            play.src = "img/pause.svg";
        } catch (error) {
            play.src = "img/play.svg";
            console.error("Audio playback failed:", error);
        }
    } else {
        play.src = "img/play.svg";
    }
}

async function loadPlaylist(playlist) {
    songs = playlist.songs.map(path => {
        const parts = path.split("/");
        const name = parts.pop();
        const encodedPath = parts.concat(name).map(encodeURIComponent).join("/");

        return {
            name,
            src: `/songs/${encodedPath}`
        };
    });

    const songUL = document.querySelector(".songList ul");
    songUL.innerHTML = "";

    songs.forEach((song, index) => {
        songUL.innerHTML += `
            <li>
                <img class="invert" width="34" src="img/music.svg" alt="">
                <div class="info">
                    <div>${song.name}</div>
                    <div>${playlist.title}</div>
                </div>
                <div class="playnow">
                    <span>Play Now</span>
                    <img class="invert" src="img/play.svg" alt="">
                </div>
            </li>
        `;

        songUL.lastElementChild.addEventListener("click", () => {
            playMusic(songs[index]);
        });
    });
}

// Display playlists from the JSON catalog
async function displayAlbums() {
    const cardContainer = document.querySelector(".cardContainer");

    if (!cardContainer) {
        console.error("Album container .cardContainer was not found.");
        return;
    }

    try {
        const response = await fetch("/songs/playlists.json");

        if (!response.ok) {
            throw new Error("Could not load songs/playlists.json");
        }

        const albumFolders = await response.json();
        const playlists = [];

        for (const folder of albumFolders) {
            const infoResponse = await fetch(`/songs/${folder}/info.json`);

            if (!infoResponse.ok) {
                console.warn(`Album information not found: ${folder}`);
                continue;
            }

            playlists.push(await infoResponse.json());
        }

        cardContainer.innerHTML = "";

        playlists.forEach((playlist, index) => {
            const isExternalCover = /^https?:\/\//i.test(playlist.cover);
            const encodedCover = isExternalCover
                ? ""
                : playlist.cover.split("/")
                    .map(encodeURIComponent)
                    .join("/");
            const coverPath = isExternalCover
                ? playlist.cover
                : playlist.cover.startsWith("/")
                    ? encodedCover
                    : `/songs/${encodedCover}`;

            cardContainer.innerHTML += `
                <div data-playlist="${index}" class="card">
                    <div class="play">
                        <svg width="16" height="16" viewBox="0 0 24 24"
                            fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M5 20V4L19 12L5 20Z"
                                stroke="#141B34" fill="#000" stroke-width="1.5"
                                stroke-linejoin="round" />
                        </svg>
                    </div>
                    <img src="${coverPath}" alt="${playlist.title}">
                    <h2>${playlist.title}</h2>
                    <p>${playlist.description}</p>
                </div>
            `;
        });

        Array.from(cardContainer.getElementsByClassName("card"))
            .forEach(card => {
                card.addEventListener("click", async () => {
                    const playlist = playlists[Number(card.dataset.playlist)];
                    await loadPlaylist(playlist);

                    if (songs.length > 0) {
                        await playMusic(songs[0]);
                    }
                });
            });

        return playlists;
    } catch (error) {
        console.error("Could not load playlists:", error);
        return [];
    }
}

// Main function
async function main() {
    try {
        const playlists = await displayAlbums();

        if (playlists.length > 0) {
            await loadPlaylist(playlists[0]);

            if (songs.length > 0) {
                await playMusic(songs[0], true);
            }
        }

    } catch (error) {
        console.error("Initialization failed:", error);
    }

    // Play and pause
    play.addEventListener("click", async () => {
        if (currentSong.paused) {
            try {
                await currentSong.play();
                play.src = "img/pause.svg";
            } catch (error) {
                console.error("Audio playback failed:", error);
            }
        } else {
            currentSong.pause();
            play.src = "img/play.svg";
        }
    });

    // Update song time and seekbar
    currentSong.addEventListener("timeupdate", () => {
        document.querySelector(".songtime").textContent =
            `${secondsToMinutesSeconds(currentSong.currentTime)} / ` +
            `${secondsToMinutesSeconds(currentSong.duration)}`;

        if (Number.isFinite(currentSong.duration) && currentSong.duration > 0) {
            document.querySelector(".circle").style.left =
                (currentSong.currentTime / currentSong.duration) * 100 + "%";
        }
    });

    // Seekbar
    document.querySelector(".seekbar").addEventListener("click", event => {
        if (!Number.isFinite(currentSong.duration) || currentSong.duration <= 0) {
            return;
        }

        const seekbar = event.currentTarget;
        const rect = seekbar.getBoundingClientRect();

        const percent = Math.max(
            0,
            Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)
        );

        document.querySelector(".circle").style.left = percent + "%";

        currentSong.currentTime = (currentSong.duration * percent) / 100;
    });

    // Mobile menu
    document.querySelector(".hamburger").addEventListener("click", () => {
        document.querySelector(".left").style.left = "0";
    });

    document.querySelector(".close").addEventListener("click", () => {
        document.querySelector(".left").style.left = "-120%";
    });

    // Previous song
    previous.addEventListener("click", async () => {
        const index = songs.indexOf(currentTrack);

        if (index > 0) {
            await playMusic(songs[index - 1]);
        }
    });

    // Next song
    next.addEventListener("click", async () => {
        const index = songs.indexOf(currentTrack);

        if (index >= 0 && index < songs.length - 1) {
            await playMusic(songs[index + 1]);
        }
    });

    // Volume control
    const volumeInput = document.querySelector(".range input");

    volumeInput.addEventListener("input", event => {
        currentSong.volume = Number(event.target.value) / 100;

        const volumeIcon = document.querySelector(".volume>img");

        if (currentSong.volume > 0) {
            volumeIcon.src = volumeIcon.src.replace("mute.svg", "volume.svg");
        } else {
            volumeIcon.src = volumeIcon.src.replace("volume.svg", "mute.svg");
        }
    });

    // Mute and unmute
    document.querySelector(".volume>img").addEventListener("click", event => {
        const volumeIcon = event.currentTarget;

        if (currentSong.volume > 0) {
            currentSong.dataset.previousVolume = currentSong.volume;
            currentSong.volume = 0;
            volumeInput.value = 0;
            volumeIcon.src = volumeIcon.src.replace("volume.svg", "mute.svg");
        } else {
            const previousVolume = Number(currentSong.dataset.previousVolume) || 0.1;

            currentSong.volume = previousVolume;
            volumeInput.value = previousVolume * 100;
            volumeIcon.src = volumeIcon.src.replace("mute.svg", "volume.svg");
        }
    });

}



main();