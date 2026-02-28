import { dotnet } from './_framework/dotnet.js'

const { setModuleImports, getAssemblyExports, getConfig, runMain } = await dotnet.create();

const config = getConfig();
const exports = await getAssemblyExports(config.mainAssemblyName);

const allTranslations = {
    en: {
        "generic-table.heading.field-name": "Field",
        "generic-table.heading.field-value": "Value",
        "generic-table.content.no-data": "No Data",

        "equipment-table.caption": "Equipment",
        "equipment-table.field.tube-config": "Tube Configuration",

        "visit-table.caption": "Appointment",
        "visit-table.field.institution": "Institution",
        "visit-table.field.exposure-date": "Capture Date",
        "visit-table.field.care-type": "Care Type",
        "visit-table.field.projection": "Projection",
        "visit-table.field.radiologist": "Radiologist",

        "patient-table.caption": "Patient",
        "patient-table.field.patient-name": "Full Name",
        "patient-table.field.patient-address": "Address",
        "patient-table.field.patient-birth-date": "Birth Date",
        "patient-table.field.patient-sex": "Sex",

        "file-selector.only-one-file-allowed": "Please select only one file.",
        "file-selector.only-stl-files-allowed": "Only proprietary stl format is supported.",

        "loading.message": "Loading",
        "loading.note": "It may take up to one minute to load the file"
    },
    ru: {
        "generic-table.heading.field-name": "Поле",
        "generic-table.heading.field-value": "Значение",
        "generic-table.content.no-data": "Нет данных",

        "equipment-table.caption": "Оборудование",
        "equipment-table.field.tube-config": "Параметры трубки",

        "visit-table.caption": "Визит",
        "visit-table.field.institution": "Учреждение",
        "visit-table.field.exposure-date": "Дата cнимка",
        "visit-table.field.care-type": "Условия оказания помощи",
        "visit-table.field.projection": "Проекция",
        "visit-table.field.radiologist": "Рентгенолог",

        "patient-table.caption": "Пациент",
        "patient-table.field.patient-name": "ФИО",
        "patient-table.field.patient-address": "Адрес",
        "patient-table.field.patient-birth-date": "Дата рождения",
        "patient-table.field.patient-sex": "Пол",

        "file-selector.only-one-file-allowed": "Можно выбрать только один файл.",
        "file-selector.only-stl-files-allowed": "Поддерживаются только нестандартные .stl файлы.",

        "loading.message": "Загрузка",
        "loading.note": "Загрузка файла может занять до одной минуты"
    }
};

const translation = navigator.language.startsWith("ru")
    ? allTranslations.ru
    : allTranslations.en;

function t(key) {
    return translation[key] || key;
}

const equipmentTableMetadata = {
    caption: t("equipment-table.caption"),
    fields: [
        { id: "TubeConfig", name: t("equipment-table.field.tube-config") }
    ]
};

const appointmentTableMetadata = {
    caption: t("visit-table.caption"),
    fields: [
        { id: "Institution", name: t("visit-table.field.institution") },
        { id: "ExposureDate", name: t("visit-table.field.exposure-date") },
        { id: "CareType", name: t("visit-table.field.care-type") },
        { id: "Projection", name: t("visit-table.field.projection") },
        { id: "Radiologist", name: t("visit-table.field.radiologist") }
    ]
}

const patientTableMetadata = {
    caption: t("patient-table.caption"),
    fields: [
        { id: "PatientName", name: t("patient-table.field.patient-name") },
        { id: "PatientAddress", name: t("patient-table.field.patient-address") },
        { id: "BirthDate", name: t("patient-table.field.patient-birth-date") },
        { id: "Sex", name: t("patient-table.field.patient-sex") }
    ]
}

const metadataContainer = document.getElementById("metadata-tables-container");
function updateMetadata(metadata) {
    const html = [];

    function createMetadataTable(tableMetadata) {
        html.push(`<metadata-table caption=\"${tableMetadata.caption}\" no-data-label=\"${t("generic-table.content.no-data")}\" field-label=\"${t("generic-table.heading.field-name")}\" value-label=\"${t("generic-table.heading.field-value")}\">`);
        for (const field of tableMetadata.fields) {
            const value = metadata[field.id] || "";
            value && html.push(`<metadata-row name=\"${field.name}\">${value}</metadata-row>`);
        }
        html.push(`</metadata-table>`);
    }

    createMetadataTable(appointmentTableMetadata);
    createMetadataTable(patientTableMetadata);
    createMetadataTable(equipmentTableMetadata);

    metadataContainer.innerHTML = html.join("");
}

updateMetadata({});

const loadingOverlay = document.getElementById('loading-overlay');
loadingOverlay.removeAttribute('visible');
loadingOverlay.setAttribute('message', t('loading.message'));
loadingOverlay.setAttribute('note', t('loading.note'));

const stlRegex = /.+\.stl$/i;
document.getElementById('file-input').addEventListener('change', function (event) {
    const files = event.target.files;

    if (files.length > 1) {
        event.target.value = '';
        alert(t("file-selector.only-one-file-allowed"));
        return;
    }

    const file = files[0];

    if (!stlRegex.test(file.name)) {
        event.target.value = '';
        alert(t("file-selector.only-stl-files-allowed"));
        return;
    }

    loadingOverlay.setAttribute('visible', 'true');

    setTimeout(function () {
        file.arrayBuffer()
            .then(function (arrayBuffer) {
                const bytes = new Uint8Array(arrayBuffer);
                exports.XRayFileReaderWrapper.Open(bytes);

                updateMetadata(JSON.parse(exports.XRayFileReaderWrapper.GetMetadata()));

                document.getElementById('x-ray-image').setAttribute('src', exports.XRayFileReaderWrapper.GetImageSrc());
            })
            .finally(function () { loadingOverlay.removeAttribute('visible'); });
    }, 100); // Ensure loading overlay is rendered before processing the file)
});

await runMain();