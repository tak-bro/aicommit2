{
  description = "aicommit2 - A Reactive CLI that generates git commit messages with various AI";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
  };

  outputs = inputs @ {
    self,
    flake-parts,
    ...
  }:
    flake-parts.lib.mkFlake {inherit inputs;} {
      systems = ["x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin"];

      perSystem = {pkgs, ...}: {
        packages.default = pkgs.stdenvNoCC.mkDerivation (finalAttrs: {
          pname = "aicommit2";
          version = "v2.4.14";
          src = self;

          pnpmDeps = pkgs.pnpm.fetchDeps {
            inherit (finalAttrs) pname version src;
            fetcherVersion = 1;
            hash = "sha256-BkJZldFkAGqDsTQ2a/NM4W1vVGNzc1HysqeYFG25Hd4=";
          };

          nativeBuildInputs = [
            pkgs.nodejs
            pkgs.pnpm.configHook
          ];
          buildInputs = [pkgs.nodejs];

          buildPhase = ''
            runHook preBuild
            sed -i 's/"version": "0.0.0-semantic-release"/"version": "${finalAttrs.version}"/' package.json
            pnpm build
            runHook postBuild
          '';

          installPhase = ''
            runHook preInstall

            mkdir -p $out/{bin,lib/aicommit2}
            cp -r {dist,node_modules} $out/lib/aicommit2

            ln -s $out/lib/aicommit2/dist/cli.mjs $out/bin/aicommit2
            ln -s $out/lib/aicommit2/dist/cli.mjs $out/bin/aic2

            runHook postInstall
          '';

          meta = {
            description = "A Reactive CLI that generates git commit messages with various AI";
            homepage = "https://github.com/tak-bro/aicommit2";
            license = pkgs.lib.licenses.mit;
            mainProgram = "aicommit2";
          };
        });

        devShells.default = pkgs.mkShell {
          buildInputs = [
            pkgs.nodejs
            pkgs.pnpm
            pkgs.pre-commit
          ];
          shellHook = ''
            export PATH=$PWD/node_modules/.bin:$PATH
          '';
        };
      };
    };
}
