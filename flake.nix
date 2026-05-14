{
  description = "aicommit2 - A Reactive CLI that generates git commit messages with various AI";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
  };

  outputs =
    inputs@{
      self,
      flake-parts,
      ...
    }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [
        "x86_64-linux"
        "aarch64-darwin"
      ];

      perSystem =
        { pkgs, system, ... }:
        {
          packages.default = pkgs.stdenvNoCC.mkDerivation (finalAttrs: {
            pname = "aicommit2";
            version = "v2.5.19";
            src = self;

            pnpmDeps = pkgs.pnpm.fetchDeps {
              inherit (finalAttrs) pname version src;
              fetcherVersion = 3;
              hash = "sha256-D9H1bkvno+F2uWE3Lj+EWn1ytBknNh0NWJj7Grmm3fk=";
            };

            nativeBuildInputs = [
              pkgs.nodejs
              pkgs.pnpm.configHook
            ];
            buildInputs = [ pkgs.nodejs ];

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

          formatter = pkgs.nixfmt;

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
