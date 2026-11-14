import json
from pathlib import Path
p=Path(__file__).resolve().parents[1]/'anatomy/data/editorial_cards.json'
records=json.loads(p.read_text(encoding='utf8'))
# Author-written overview and broad-function descriptions. These are educational
# editorial content, not copied textbook passages or source-mesh metadata.
info={
'Skin':('The outer covering of the body, composed of epidermis, dermis, and underlying associated structures.','Acts as a protective barrier, contributes to sensation and thermoregulation.'),
'Epidermis':('The superficial epithelial component of skin, composed primarily of keratinocytes.','Forms a water-resistant barrier and participates in cutaneous defense.'),
'Dermis':('The connective-tissue layer beneath the epidermis containing vessels, nerves, follicles, and glands.','Provides strength, elasticity, nutrition to the epidermis, and sensory support.'),
'Hair follicles':('Epidermal appendages extending into the dermis from which hair shafts grow.','Produce hair and contribute to cutaneous sensation.'),
'Sebaceous glands':('Holocrine glands usually connected to hair follicles within the dermis.','Release sebum that contributes to lubrication of skin and hair.'),
'Pituitary gland':('An endocrine organ in the hypophyseal fossa of the sphenoid bone connected to the hypothalamus.','Releases hormones involved in growth, metabolism, reproduction, and water balance.'),
'Thyroid gland':('An anterior cervical endocrine gland situated around the upper trachea, usually comprising two lobes and an isthmus.','Produces thyroid hormones and calcitonin.'),
'Parathyroid glands':('Small endocrine glands commonly located on the posterior aspect of the thyroid gland.','Secrete parathyroid hormone involved in calcium homeostasis.'),
'Adrenal glands':('Paired endocrine organs located superomedially to the kidneys, each with cortex and medulla.','Produce steroid hormones and catecholamines.'),
'Pancreatic islets':('Endocrine cell clusters distributed throughout the pancreas.','Secrete hormones including insulin and glucagon to regulate metabolism.'),
'Spleen':('A lymphoid organ in the left upper abdomen, related to the stomach and diaphragm.','Filters blood and participates in immune surveillance.'),
'Thymus':('A primary lymphoid organ situated in the anterior mediastinum, most prominent in childhood.','Supports T lymphocyte maturation.'),
'Lymph nodes':('Small encapsulated lymphoid structures distributed along lymphatic vessels.','Filter lymph and support antigen-driven immune responses.'),
'Thoracic duct':('A major lymphatic channel ascending through the thorax to drain near the left venous angle.','Returns lymph from much of the body to the venous circulation.'),
'Uterus':('A hollow muscular pelvic organ between the urinary bladder and rectum, comprising fundus, body, and cervix.','Supports implantation, gestation, and parturition.'),
'Ovaries':('Paired female gonads located in the pelvis adjacent to the uterus.','Produce oocytes and secrete ovarian hormones.'),
'Uterine tubes':('Paired muscular tubes extending from the uterine cornua toward the ovaries.','Transport oocytes and commonly provide the site of fertilization.'),
'Testes':('Paired male gonads within the scrotum, composed of seminiferous tubules and interstitial tissue.','Produce spermatozoa and testosterone.'),
'Prostate gland':('An accessory male reproductive gland located inferior to the urinary bladder and surrounding the prostatic urethra.','Contributes secretions to seminal fluid.'),
'Superior vena cava':('A large systemic vein returning blood from structures superior to the diaphragm to the right atrium.','Conducts deoxygenated systemic venous blood to the heart.'),
'Inferior vena cava':('A major vein ascending on the right side of the aorta and entering the right atrium.','Returns systemic venous blood from the lower body to the heart.'),
'Pulmonary trunk':('A major artery arising from the right ventricle and dividing into right and left pulmonary arteries.','Carries blood toward the lungs for gas exchange.'),
'Trachea':('An air-conducting tube with C-shaped cartilage rings extending from the larynx to the main bronchi.','Conducts and conditions inspired air.'),
'Bronchial tree':('The branching airways formed by the main, lobar, segmental, and smaller bronchi.','Distributes air through the pulmonary parenchyma.'),
'Urethra':('A duct carrying urine from the bladder to the exterior, with sex-specific anatomical course and relationships.','Provides the distal pathway for urinary elimination.'),
'Large intestine':('The distal gastrointestinal tract containing cecum, colon, rectum, and anal canal.','Absorbs water and electrolytes and stores and conveys fecal material.'),
'Gallbladder':('A pear-shaped sac on the visceral surface of the liver communicating with the biliary tree.','Stores and concentrates bile between meals.'),
'Spinal nerves':('Paired mixed nerves formed by union of anterior and posterior roots of spinal cord segments.','Convey somatic and autonomic sensory and motor fibers.'),
'Pelvis':('The bony ring of paired hip bones, sacrum, and coccyx forming the basin between trunk and lower limbs.','Transfers trunk loads to lower limbs and protects pelvic organs.'),
'Mandible':('The lower jaw bone forming joints with the temporal bones.','Supports lower dentition and jaw movements.'),
'Ribs':('Curved bones articulating posteriorly with thoracic vertebrae and contributing to the thoracic cage.','Protect thoracic organs and support respiratory movement.'),
'Clavicle':('An S-shaped long bone connecting the sternum to the scapula at the acromioclavicular joint.','Acts as a strut supporting the shoulder girdle.'),
'Pectoralis major':('A large superficial anterior chest muscle attaching to the humerus.','Adducts and medially rotates the arm; portions also assist arm flexion.'),
'Latissimus dorsi':('A broad back muscle extending from trunk structures to the proximal humerus.','Extends, adducts, and medially rotates the upper limb.'),
}
extra={
'Left atrium':('A posterior heart chamber receiving oxygenated blood from the pulmonary veins.','Transfers blood through the mitral valve to the left ventricle.','Cardiovascular'),
'Right atrium':('A right-sided heart chamber receiving systemic venous blood through the venae cavae and coronary sinus.','Transfers blood through the tricuspid valve to the right ventricle.','Cardiovascular'),
'Left ventricle':('A thick-walled cardiac chamber communicating with the left atrium and aorta.','Ejects oxygenated blood into the systemic circulation.','Cardiovascular'),
'Right ventricle':('An anterior cardiac chamber communicating with the right atrium and pulmonary trunk.','Ejects blood into the pulmonary circulation.','Cardiovascular'),
'Mitral valve':('A two-leaflet atrioventricular valve between the left atrium and left ventricle.','Helps prevent backward flow during ventricular systole.','Cardiovascular'),
'Tricuspid valve':('The atrioventricular valve separating right atrium and right ventricle.','Helps prevent backward flow during ventricular systole.','Cardiovascular'),
'Aortic valve':('A semilunar valve between the left ventricle and ascending aorta.','Prevents backward flow from the aorta into the left ventricle during diastole.','Cardiovascular'),
'Pulmonary valve':('A semilunar valve between the right ventricle and pulmonary trunk.','Prevents backward flow into the right ventricle during diastole.','Cardiovascular'),
'Esophagus':('A muscular tube passing from the pharynx through the thorax to the stomach.','Transports swallowed material via coordinated peristalsis.','Digestive'),
'Duodenum':('The first portion of the small intestine receiving gastric contents, bile, and pancreatic secretions.','Neutralizes chyme and participates in digestion and absorption.','Digestive'),
'Jejunum':('The middle portion of the small intestine between duodenum and ileum.','A major site of nutrient absorption.','Digestive'),
'Ileum':('The terminal part of the small intestine joining the cecum at the ileocecal junction.','Absorbs nutrients including vitamin B12 and bile salts.','Digestive'),
'Pancreas':('A retroperitoneal gland behind the stomach consisting of head, body and tail.','Provides digestive enzymes and endocrine hormones.','Digestive'),
'Cecum':('A pouch-like initial part of the large intestine adjacent to the ileocecal junction.','Receives ileal contents and begins colonic processing.','Digestive'),
'Ascending colon':('The colonic segment ascending from cecum toward hepatic flexure.','Absorbs water and transports intestinal contents.','Digestive'),
'Descending colon':('The colonic segment extending from splenic flexure into the sigmoid colon.','Conveys and stores intestinal contents.','Digestive'),
'Rectum':('A terminal pelvic segment of the large intestine continuous with sigmoid colon and anal canal.','Stores feces before defecation.','Digestive'),
'Larynx':('A cartilaginous airway structure between pharynx and trachea containing the vocal folds.','Participates in phonation and protection of the lower airway.','Respiratory'),
'Right lung':('The right pulmonary organ, commonly divided into superior, middle and inferior lobes.','Participates in gas exchange across its alveoli.','Respiratory'),
'Left lung':('The left pulmonary organ, typically with superior and inferior lobes and a cardiac notch.','Participates in gas exchange across its alveoli.','Respiratory'),
'Alveoli':('Microscopic air spaces in the distal pulmonary parenchyma enclosed by thin walls.','Provide surface for exchange of respiratory gases.','Respiratory'),
'Right kidney':('The right paired retroperitoneal kidney beneath the liver.','Filters blood, regulates fluid balance and produces urine.','Urinary'),
'Left kidney':('The left paired retroperitoneal kidney.','Filters blood, regulates fluid balance and produces urine.','Urinary'),
'Ureter':('A muscular duct conveying urine from the renal pelvis to the urinary bladder.','Transports urine by peristaltic contractions.','Urinary'),
'Renal cortex':('The peripheral zone of kidney containing renal corpuscles and sections of nephrons.','Participates in filtration and tubular handling.','Urinary'),
'Renal medulla':('The inner kidney containing medullary pyramids and loops of Henle.','Supports urine concentration and transport.','Urinary'),
'Cerebrum':('The largest part of the brain with cerebral hemispheres and cortical and subcortical regions.','Supports perception, voluntary movement, cognition and language.','Nervous'),
'Brainstem':('The neural axis consisting of midbrain, pons and medulla oblongata.','Contains ascending and descending pathways and major autonomic nuclei.','Nervous'),
'Medulla oblongata':('The caudal part of the brainstem continuous with the spinal cord.','Contains multiple vital autonomic and sensory-motor nuclei.','Nervous'),
'Hippocampus':('A medial temporal-lobe structure forming part of the hippocampal formation.','Important for memory formation.','Nervous'),
'Corpus callosum':('A large commissural white-matter tract connecting the cerebral hemispheres.','Supports interhemispheric communication.','Nervous'),
'Optic nerve':('The second cranial nerve formed by retinal ganglion cell axons.','Transmits visual information toward the brain.','Nervous'),
'Femoral artery':('A major arterial vessel of the lower limb passing through the femoral triangle.','Supplies the thigh and provides distal lower-limb arterial flow.','Cardiovascular'),
'Carotid artery':('A major paired arterial conduit in the neck supplying the head and neck.','Provides arterial blood to head and neck regions.','Cardiovascular'),
'Brachial plexus':('A network of nerve roots and trunks in the neck and axillary region.','Provides much of the peripheral innervation of the upper limb.','Nervous'),
'Tendon':('Dense regular connective tissue commonly connecting muscle to bone.','Transmits forces generated by muscle contraction.','Articular'),
'Ligament':('A fibrous connective tissue structure connecting bones and supporting joints.','Contributes to joint stability.','Articular'),
'Sternum':('A flat anterior thoracic bone comprising manubrium, body and xiphoid process.','Provides an anterior attachment for ribs and protects mediastinal structures.','Skeletal'),
'Sacrum':('A triangular bone formed by fused sacral vertebrae at the posterior pelvis.','Transfers trunk weight to the pelvis.','Skeletal'),
'Radius':('The lateral forearm bone in anatomical position.','Participates in elbow, forearm and wrist articulations.','Skeletal'),
'Ulna':('The medial forearm bone in anatomical position.','Provides the major stabilizing articulation of the elbow.','Skeletal'),
'Tibia':('The medial, weight-bearing long bone of the leg.','Transmits load from femur to ankle.','Skeletal'),
'Fibula':('The lateral bone of the leg, relatively less weight-bearing than the tibia.','Supports ankle stability and provides muscle attachment sites.','Skeletal'),
'Quadriceps femoris':('A group of four muscles on the anterior thigh.','Primarily extends the knee.','Muscular'),
'Biceps femoris':('A posterior thigh muscle in the hamstring group.','Flexes knee and contributes to hip extension via its long head.','Muscular'),
'Soleus':('A broad posterior leg muscle deep to gastrocnemius.','Plantarflexes the foot, especially during standing.','Muscular'),
'Rotator cuff':('A group of four shoulder muscles and tendons associated with the glenohumeral joint.','Stabilizes the humeral head and assists shoulder movement.','Muscular')
}
for r in records:
    if not r['overview'] and r['name'] in info:
        r['overview'],r['function']=info[r['name']]
        r['reference']='MedStudy original editorial summary; verify against primary anatomical references before use in formal teaching.'
existing={x['name'].lower() for x in records}
for name,(overview,fn,sys) in extra.items():
    if name.lower() in existing:continue
    records.append({'id':name.lower().replace(' ','-'),'name':name,'system':sys,'region':'Refer to source model hierarchy','overview':overview,'relations':'','function':fn,'clinical':'','fields':{},'reference':'MedStudy original educational summary; independent medical review required.'})
p.write_text(json.dumps(records,indent=2,ensure_ascii=False),encoding='utf8')
print('Cards',len(records),'detailed',len([r for r in records if r['overview']]))
