# Hearthguard 3D asset credits

The packaged assets are local and require no runtime asset service. The following assets are CC0. Only the freely offered Standard content is included from the Quaternius kits.

- [Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html): cropped humanoid head, eyes, eyebrows and hair.
- [Quaternius Modular Character Outfits Fantasy](https://quaternius.com/packs/modularcharacteroutfitsfantasy.html): rigged peasant and ranger bodies.
- [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) and [Library 2](https://quaternius.com/packs/universalanimationlibrary2.html): selected movement, interaction, combat and death clips.
- [Quaternius Medieval Village Megakit](https://quaternius.com/packs/medievalvillagemegakit.html): modular walls, roofs, doors, floors and village props.
- [Quaternius Ultimate Animated Animals](https://quaternius.com/packs/ultimateanimatedanimals.html): deer and horse meshes with skeletal animations.
- Poly Haven: [cracked boulder](https://polyhaven.com/a/rock_boulder_cracked), [pine bark and branch textures](https://polyhaven.com/a/pine_tree_01), [forest floor](https://polyhaven.com/a/forest_floor). [Poly Haven asset license](https://polyhaven.com/license).

Archive license text is retained in public/models. Game-specific assembly, pine branching geometry, wheat, equipment and defenses are authored in the renderer. Terrain and geometry fit the existing simulation colliders. Assets are edited for head separation, clip selection, batching, deduplicated texture paths and a maximum 1024px texture dimension. Geometry and animations are bundled as GLB files, not externally streamed.

Repack with `python scripts/pack-art.py` then `node scripts/simplify-rock.mjs` (Pillow required) using the downloaded source archives in `.art-source`. The deployable `dist` needs only the packaged public assets; source archives are not runtime dependencies. This is detailed game-ready medieval artwork; it does not claim cinematic photorealism.
