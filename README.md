# osu-pps-downloader

Easily download osu! mapsets based on their overweightness thanks to [`osu-pps.com`](https://osu-pps.com/)'s ratings.

![osu! pps downloader - downloading showcase](https://raw.githubusercontent.com/Sayrix/osu-pps-downloader/refs/heads/main/github/readme.gif)

Enjoy the fastest download speed thanks to a smart mirror selection system that automatically chooses the best mirror for you among [`osu.direct`](https://osu.direct), [`nerinyan`](https://nerinyan.moe), [`mimo`](https://catboy.best), and [`nekoha`](https://nekoha.moe). It also supports rate limits and downtimes, so you can download your maps without interruption.

# How to use

Download the latest release from the [Releases](https://github.com/Sayrix/osu-pps-downloader/releases) page. After that, simply run the executable and follow the on-screen instructions to filter and download your desired osu! mapsets based on their overweightness.

![osu! pps downloader - downloader configuration showcase](https://raw.githubusercontent.com/Sayrix/osu-pps-downloader/refs/heads/main/github/readme2.gif)

# How to contribute

This project fully uses [Bun](https://bun.sh/) as its runtime and package manager. To contribute, please follow these steps:

1. **Clone the repository**:

```bash
git clone https://github.com/Sayrix/osu-pps-downloader.git
```

2. **Navigate to the project directory**:

```bash
cd osu-pps-downloader
```

3. **Install dependencies**:

```bash
bun install
```

4. **Run the application**:

```bash
bun run start
```

# How to build

```bash
bun run build
```
