PLACE AUTHENTIC LICENSED ANATOMY FILES HERE
==========================================

Do not add artificial geometry or rename the anatomical source GLB files.

The complete set configured for this release has:
  - 13 male per-system .glb files (Z-Anatomy / BodyParts3D)
  - 7 female per-system .glb files (NIH HuBMAP HRA partial female atlas)
  - manifest.json and manifest_female.json (names, stable IDs, hierarchy)
  - LICENSE and NOTICE (original mesh attribution)

For automatic download and verification on GitHub Pages, enable the included
.github/workflows/deploy.yml and push the project to the main branch. The
workflow downloads and validates every GLB before publishing.

For manual installation on a computer with internet:
  python3 scripts/fetch_models.py --all

The model downloader pins source commit c830ea3a3b62030bf08e7353e8cb641bd38d2bfa
at https://github.com/Nurkan1/Anatria-3D and verifies GLB 2.0 magic,
file byte count and source manifest shape. The package contains no phantom GLBs.

If these files are absent on a static server, the browser tries the pinned
public CDN URLs. Remote loading requires internet and can fail with CORS or
provider downtime. Locally hosted models are strongly preferred.
