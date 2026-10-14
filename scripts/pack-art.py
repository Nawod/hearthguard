"""Pack licensed source glTF assets into local GLBs with deduplicated external textures."""
from pathlib import Path
from zipfile import ZipFile
import json,struct,base64,hashlib
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/models';OUT.mkdir(parents=True,exist_ok=True);(OUT/'textures').mkdir(exist_ok=True)
FMT={5120:'b',5121:'B',5122:'h',5123:'H',5125:'I',5126:'f'}
WIDTH={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def raw_uri(uri,read):
 if uri.startswith('data:'):return base64.b64decode(uri.split(',',1)[1])
 return read(uri)
def serialize(data,binary,path):
 data['buffers']=[{'byteLength':len(binary)}]
 data['asset']['generator']='Hearthguard local asset packaging'
 js=json.dumps(data,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
 binary+=b'\0'*((-len(binary))%4)
 path.write_bytes(struct.pack('<III',0x46546c67,2,12+8+len(js)+8+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary)
def pack(data,read,path,head_only=False):
 binary=bytearray();offsets=[]
 for buffer in data.get('buffers',[]):
  binary.extend(b'\0'*((-len(binary))%4));offsets.append(len(binary));binary.extend(raw_uri(buffer['uri'],read))
 for view in data.get('bufferViews',[]):view['byteOffset']=view.get('byteOffset',0)+offsets[view.get('buffer',0)];view['buffer']=0
 def values(index):
  a=data['accessors'][index];v=data['bufferViews'][a['bufferView']];w=WIDTH[a['type']];fmt=FMT[a['componentType']];size=struct.calcsize(fmt)*w;offset=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',size)
  return [struct.unpack_from('<'+fmt*w,binary,offset+i*stride)for i in range(a['count'])]
 def accessor(rows,original):
  a={k:v for k,v in original.items()if k not in ('bufferView','byteOffset','count','min','max')};fmt=FMT[a['componentType']];binary.extend(b'\0'*((-len(binary))%4));offset=len(binary)
  for row in rows:binary.extend(struct.pack('<'+fmt*len(row),*row))
  view=len(data['bufferViews']);data['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(binary)-offset})
  a.update(bufferView=view,count=len(rows));
  if rows and original['type']=='VEC3':a['min']=[min(row[i]for row in rows)for i in range(3)];a['max']=[max(row[i]for row in rows)for i in range(3)]
  index=len(data['accessors']);data['accessors'].append(a);return index
 if head_only:
  for mesh in data['meshes']:
   for p in mesh['primitives']:
    positions=values(p['attributes']['POSITION']);tri=[x[0]for x in values(p['indices'])];keep=[]
    for i in range(0,len(tri),3):
     if all(positions[v][1]>1.50 for v in tri[i:i+3]):keep.extend(tri[i:i+3])
    used=sorted(set(keep));mapping={old:new for new,old in enumerate(used)}
    for name,index in list(p['attributes'].items()):
     original_values=values(index);p['attributes'][name]=accessor([original_values[i]for i in used],data['accessors'][index])
    p['indices']=accessor([(mapping[i],)for i in keep],data['accessors'][p['indices']])
 for image in data.get('images',[]):
  if 'uri'not in image:continue
  content=raw_uri(image['uri'],read);suffix=Path(image['uri']).suffix.lower()if not image['uri'].startswith('data:')else('.png'if 'image/png' in image['uri']else'.jpg')
  name=hashlib.sha256(content).hexdigest()[:20]+suffix;(OUT/'textures'/name).write_bytes(content);image['uri']='textures/'+name
 serialize(data,bytes(binary),path)
def fromzip(archive,suffix,target,head=False):
 with ZipFile(ROOT/'.art-source'/archive)as z:
  source=next(n for n in z.namelist()if n.endswith(suffix));data=json.loads(z.read(source));prefix=source.rsplit('/',1)[0]+'/'
  def read(uri):
   desired=prefix+uri
   if desired in z.namelist():return z.read(desired)
   name=Path(uri).name.replace('_png','');matches=[n for n in z.namelist()if Path(n).name==name]
   if not matches:raise ValueError(f'Missing resource: {uri}')
   return z.read(matches[0])
  pack(data,read,OUT/target,head)
  license=next(n for n in z.namelist()if 'License'in n and n.endswith('.txt'));(OUT/(archive.replace('.zip','')+'-license.txt')).write_bytes(z.read(license))
def clipzip(archive,filename,target,clips):
 with ZipFile(ROOT/'.art-source'/archive)as z:
  source=next(n for n in z.namelist()if n.endswith(filename));b=z.read(source);size=struct.unpack_from('<I',b,12)[0];data=json.loads(b[20:20+size]);start=20+size+8;binary=b[start:]
  data['animations']=[a for a in data.get('animations',[])if a['name']in clips]
  serialize(data,binary,OUT/target)
fromzip('base.zip','Superhero_Male_FullBody.gltf','head.glb',True)
fromzip('base.zip','Rigged to Head Bone/glTF (Godot -Unreal)/Hair_SimpleParted.gltf','hair.glb')
fromzip('outfits.zip','Outfits/Male_Peasant.gltf','character.glb')
fromzip('outfits.zip','Outfits/Male_Ranger.gltf','ranger.glb')
clipzip('animations.zip','UAL1_Standard.glb','animations.glb',{'Idle_Loop','Walk_Loop','Jog_Fwd_Loop','Sprint_Loop','Jump_Start','Jump_Loop','Jump_Land','Sword_Attack','Sword_Idle','Punch_Jab','Punch_Cross','Death01','Fixing_Kneeling','Interact','Sitting_Idle_Loop','Hit_Chest','Push_Loop'})
clipzip('animations2.zip','UAL2_Standard.glb','actions.glb',{'Farm_Harvest','Farm_PlantSeed','TreeChopping_Loop','Consume','Sword_Block','Sword_Regular_A','Hit_Knockback'})
modules=['Wall_Plaster_Straight','Wall_Plaster_Door_Round','Wall_Plaster_Window_Wide_Round','Wall_UnevenBrick_Straight','Wall_UnevenBrick_Window_Thin_Round','DoorFrame_Round_WoodDark','Door_2_Round','Roof_RoundTiles_4x4','Roof_RoundTiles_6x6','Roof_Tower_RoundTiles','Prop_Chimney','Prop_Crate','Prop_Wagon','Prop_WoodenFence_Single','Prop_MetalFence_Ornament','Roof_Wooden_2x1_Middle','Floor_WoodDark','Window_Thin_Round1']
for name in modules:fromzip('village.zip','glTF/'+name+'.gltf','village-'+name+'.glb')
for name in ['Deer','Horse']:
 source=ROOT/'.art-source/animals'/f'{name}.gltf';pack(json.loads(source.read_text(encoding='utf-8')),lambda uri:(source.parent/uri).read_bytes(),OUT/f'{name.lower()}.glb')
print('Packed',len(list(OUT.glob('*.glb'))),'GLBs; shared textures',len(list((OUT/'textures').iterdir())))

rock=ROOT/".art-source/rock/rock.gltf"
pack(json.loads(rock.read_text(encoding="utf-8")),lambda uri:(rock.parent/uri).read_bytes(),OUT/"rock.glb")

# Browser texture budget: keep local texture dimensions at most 1024 px.
from PIL import Image
for image in OUT.rglob('*'):
 if image.suffix.lower() not in ('.png','.jpg'):continue
 with Image.open(image) as im:
  if max(im.size)>1024:
   im.thumbnail((1024,1024),Image.Resampling.LANCZOS)
   im.save(image,optimize=True,**({'quality':88}if image.suffix=='.jpg'else{}))
