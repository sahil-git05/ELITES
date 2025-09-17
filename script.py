# Create project structure and files
import os
import json

# Create the project directory structure
project_structure = """
namaste-icd11-integration/
├── backend/
│   ├── package.json
│   ├── server.js
│   ├── routes/
│   │   ├── terminology.js
│   │   ├── mapping.js
│   │   └── fhir.js
│   ├── data/
│   │   └── namaste-sample.json
│   └── utils/
│       ├── icd11-client.js
│       └── fhir-builder.js
├── frontend/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── components/
│       ├── search.js
│       └── mapping.js
└── README.md
"""

print("📁 Project Structure:")
print(project_structure)

# Sample NAMASTE data for the project
namaste_sample_data = [
    {
        "code": "NAM001",
        "display": "Vataja Jwara",
        "description": "Fever due to Vata imbalance - characterized by irregular fever patterns",
        "category": "Fever Disorders",
        "system": "Ayurveda",
        "synonyms": ["Vata Fever", "Irregular Fever"],
        "keywords": ["fever", "vata", "irregular", "nervous"]
    },
    {
        "code": "NAM002", 
        "display": "Pittaja Jwara",
        "description": "Fever due to Pitta imbalance - characterized by high temperature and burning sensation",
        "category": "Fever Disorders",
        "system": "Ayurveda", 
        "synonyms": ["Pitta Fever", "Burning Fever"],
        "keywords": ["fever", "pitta", "burning", "high temperature"]
    },
    {
        "code": "NAM003",
        "display": "Kaphaja Jwara", 
        "description": "Fever due to Kapha imbalance - characterized by low-grade fever with heaviness",
        "category": "Fever Disorders",
        "system": "Ayurveda",
        "synonyms": ["Kapha Fever", "Heavy Fever"], 
        "keywords": ["fever", "kapha", "heaviness", "low grade"]
    },
    {
        "code": "NAM004",
        "display": "Madhumeha",
        "description": "Sweet urine disease - diabetes mellitus in Ayurveda",
        "category": "Metabolic Disorders", 
        "system": "Ayurveda",
        "synonyms": ["Diabetes", "Sweet Urine Disease"],
        "keywords": ["diabetes", "sweet", "urine", "metabolic"]
    },
    {
        "code": "NAM005", 
        "display": "Rakta Gata Vata",
        "description": "Vata in blood channels - hypertension and circulation disorders",
        "category": "Circulatory Disorders",
        "system": "Ayurveda",
        "synonyms": ["Blood Pressure", "Hypertension"],
        "keywords": ["blood", "pressure", "circulation", "vata", "hypertension"]
    },
    {
        "code": "NAM006",
        "display": "Hridroga", 
        "description": "Heart diseases including cardiac disorders",
        "category": "Cardiac Disorders",
        "system": "Ayurveda",
        "synonyms": ["Heart Disease", "Cardiac Disorder"],
        "keywords": ["heart", "cardiac", "chest", "circulation"]
    },
    {
        "code": "NAM007",
        "display": "Shwasa Roga",
        "description": "Breathing disorders including asthma and respiratory issues", 
        "category": "Respiratory Disorders",
        "system": "Ayurveda",
        "synonyms": ["Asthma", "Breathing Disorder"],
        "keywords": ["asthma", "breathing", "respiratory", "lungs"]
    },
    {
        "code": "NAM008",
        "display": "Amavata",
        "description": "Rheumatoid arthritis - joint inflammation due to ama and vata",
        "category": "Musculoskeletal Disorders",
        "system": "Ayurveda", 
        "synonyms": ["Rheumatoid Arthritis", "Joint Inflammation"],
        "keywords": ["arthritis", "joints", "inflammation", "rheumatoid"]
    },
    {
        "code": "NAM009",
        "display": "Kushtha Roga",
        "description": "Skin diseases including eczema, psoriasis and dermatitis",
        "category": "Skin Disorders",
        "system": "Ayurveda",
        "synonyms": ["Skin Disease", "Dermatitis"],
        "keywords": ["skin", "eczema", "psoriasis", "dermatitis"] 
    },
    {
        "code": "NAM010",
        "display": "Apasmara",
        "description": "Epilepsy and seizure disorders affecting consciousness",
        "category": "Neurological Disorders", 
        "system": "Ayurveda",
        "synonyms": ["Epilepsy", "Seizure Disorder"],
        "keywords": ["epilepsy", "seizure", "neurological", "consciousness"]
    }
]

print(f"\n📊 Created sample dataset with {len(namaste_sample_data)} NAMASTE codes")
print("✅ Ready to generate all project files!")