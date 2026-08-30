{
  description = "sampla dev environment (Node + pnpm + ffmpeg + yt-dlp)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.nodejs_20
            pkgs.pnpm
            pkgs.ffmpeg
            pkgs.yt-dlp
          ];

          shellHook = ''
            export PNPM_HOME="$PWD/.pnpm-store"
            export PATH="$PNPM_HOME:$PATH"
            echo "sampla dev shell"
            echo "  node    $(node --version)"
            echo "  pnpm    $(pnpm --version)"
            echo "  ffmpeg  $(ffmpeg -version | head -n1 | awk '{print $3}')"
            echo "  yt-dlp  $(yt-dlp --version)"
          '';
        };
      });
}
