import loadable from "@loadable/component";
import { Box, FormControlLabel, Radio, RadioGroup } from "@material-ui/core";
import { navigate } from "raviger";
import moment from "moment";
import {
  ChangeEventHandler,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { useDispatch } from "react-redux";
import {
  CONSULTATION_SUGGESTION,
  PATIENT_CATEGORIES,
  TELEMEDICINE_ACTIONS,
  REVIEW_AT_CHOICES,
  CONSULTATION_STATUS,
} from "../../Common/constants";
import { statusType, useAbortableEffect } from "../../Common/utils";
import {
  createConsultation,
  getConsultation,
  updateConsultation,
  getPatient,
} from "../../Redux/actions";
import * as Notification from "../../Utils/Notifications.js";
import { FacilitySelect } from "../Common/FacilitySelect";
import { ErrorHelperText } from "../Common/HelperInputFields";
import { BedModel, FacilityModel } from "./models";
import { OnlineUsersSelect } from "../Common/OnlineUsersSelect";
import { UserModel } from "../Users/models";
import { BedSelect } from "../Common/BedSelect";
import { dischargePatient } from "../../Redux/actions";
import Beds from "./Consultations/Beds";
import PrescriptionBuilder, {
  PrescriptionType,
} from "../Common/prescription-builder/PrescriptionBuilder";
import PRNPrescriptionBuilder, {
  PRNPrescriptionType,
} from "../Common/prescription-builder/PRNPrescriptionBuilder";
import InvestigationBuilder, {
  InvestigationType,
} from "../Common/prescription-builder/InvestigationBuilder";
import ProcedureBuilder, {
  ProcedureType,
} from "../Common/prescription-builder/ProcedureBuilder";
import { ICD11DiagnosisModel } from "./models";
import { Cancel, Submit } from "../Common/components/ButtonV2";
import TextAreaFormField from "../Form/FormFields/TextAreaFormField";
import { FieldChangeEventHandler } from "../Form/FormFields/Utils";
import { FieldLabel } from "../Form/FormFields/FormField";
import PatientCategorySelect from "../Patient/PatientCategorySelect";
import { SelectFormField } from "../Form/FormFields/SelectFormField";
import TextFormField from "../Form/FormFields/TextFormField";
import { DiagnosisSelectFormField } from "../Common/DiagnosisSelectFormField";
import { SymptomsSelect } from "../Common/SymptomsSelect";
import DateFormField from "../Form/FormFields/DateFormField";
import useConfig from "../../Common/hooks/useConfig";
import useAppHistory from "../../Common/hooks/useAppHistory";

const Loading = loadable(() => import("../Common/Loading"));
const PageTitle = loadable(() => import("../Common/PageTitle"));

type BooleanStrings = "true" | "false";

type FormDetails = {
  symptoms: number[];
  other_symptoms: string;
  symptoms_onset_date?: Date;
  suggestion: string;
  consultation_status: number;
  patient: string;
  facility: string;
  admitted: BooleanStrings;
  admitted_to: string;
  category: string;
  admission_date?: Date;
  discharge_date: null;
  referred_to: string;
  icd11_diagnoses_object: ICD11DiagnosisModel[];
  icd11_provisional_diagnoses_object: ICD11DiagnosisModel[];
  verified_by: string;
  is_kasp: BooleanStrings;
  kasp_enabled_date: null;
  examination_details: string;
  history_of_present_illness: string;
  prescribed_medication: string;
  consultation_notes: string;
  ip_no: string;
  procedure: ProcedureType[];
  discharge_advice: PrescriptionType[];
  prn_prescription: PRNPrescriptionType[];
  investigation: InvestigationType[];
  is_telemedicine: BooleanStrings;
  action: string;
  assigned_to: string;
  assigned_to_object: UserModel | null;
  special_instruction: string;
  review_interval: number;
  weight: string;
  height: string;
  bed: BedModel | null;
  discharge_reason: string;
  cause_of_death: string;
  death_datetime: string;
  death_confirmed_doctor: string;
};

type Action =
  | { type: "set_form"; form: FormDetails }
  | { type: "set_error"; errors: FormDetails };

const initForm: FormDetails = {
  symptoms: [],
  other_symptoms: "",
  symptoms_onset_date: undefined,
  suggestion: "A",
  consultation_status: 0,
  patient: "",
  facility: "",
  admitted: "false",
  admitted_to: "",
  category: "Comfort",
  admission_date: new Date(),
  discharge_date: null,
  referred_to: "",
  icd11_diagnoses_object: [],
  icd11_provisional_diagnoses_object: [],
  verified_by: "",
  is_kasp: "false",
  kasp_enabled_date: null,
  examination_details: "",
  history_of_present_illness: "",
  prescribed_medication: "",
  consultation_notes: "",
  ip_no: "",
  procedure: [],
  discharge_advice: [],
  prn_prescription: [],
  investigation: [],
  is_telemedicine: "false",
  action: "PENDING",
  assigned_to: "",
  assigned_to_object: null,
  special_instruction: "",
  review_interval: -1,
  weight: "",
  height: "",
  bed: null,
  discharge_reason: "",
  cause_of_death: "",
  death_datetime: "",
  death_confirmed_doctor: "",
};

const initError = Object.assign(
  {},
  ...Object.keys(initForm).map((k) => ({ [k]: "" }))
);

const isoStringToDate = (isoDate: string) =>
  (moment(isoDate).isValid() && moment(isoDate).toDate()) || undefined;

const initialState = {
  form: { ...initForm },
  errors: { ...initError },
};

const consultationFormReducer = (state = initialState, action: Action) => {
  switch (action.type) {
    case "set_form": {
      return {
        ...state,
        form: action.form,
      };
    }
    case "set_error": {
      return {
        ...state,
        errors: action.errors,
      };
    }
  }
};

const scrollTo = (id: any) => {
  const element = document.querySelector(`#${id}`);
  element?.scrollIntoView({ behavior: "smooth", block: "center" });
};

export const ConsultationForm = (props: any) => {
  const { goBack } = useAppHistory();
  const { kasp_enabled, kasp_string } = useConfig();
  const dispatchAction: any = useDispatch();
  const { facilityId, patientId, id } = props;
  const [state, dispatch] = useReducer(consultationFormReducer, initialState);
  const [bed, setBed] = useState<BedModel | BedModel[] | null>(null);
  const [dischargeAdvice, setDischargeAdvice] = useState<PrescriptionType[]>(
    []
  );
  const [PRNAdvice, setPRNAdvice] = useState<PRNPrescriptionType[]>([]);
  const [InvestigationAdvice, setInvestigationAdvice] = useState<
    InvestigationType[]
  >([]);
  const [procedures, setProcedures] = useState<ProcedureType[]>([]);

  const [selectedFacility, setSelectedFacility] =
    useState<FacilityModel | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [facilityName, setFacilityName] = useState("");
  const isUpdate = !!id;
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => {
      topRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []);

  useEffect(() => {
    async function fetchPatientName() {
      if (patientId) {
        const res = await dispatchAction(getPatient({ id: patientId }));
        if (res.data) {
          setPatientName(res.data.name);
          setFacilityName(res.data.facility_object.name);
        }
      } else {
        setPatientName("");
        setFacilityName("");
      }
    }
    fetchPatientName();
  }, [dispatchAction, patientId]);

  const hasSymptoms =
    !!state.form.symptoms.length && !state.form.symptoms.includes(1);
  const isOtherSymptomsSelected = state.form.symptoms.includes(9);

  const fetchData = useCallback(
    async (status: statusType) => {
      setIsLoading(true);
      const res = await dispatchAction(getConsultation(id));
      setDischargeAdvice(res && res.data && res.data.discharge_advice);
      setPRNAdvice(
        !Array.isArray(res.data.prn_prescription)
          ? []
          : res.data.prn_prescription
      );
      setInvestigationAdvice(
        !Array.isArray(res.data.investigation) ? [] : res.data.investigation
      );
      setProcedures(
        !Array.isArray(res.data.procedure) ? [] : res.data.procedure
      );

      if (!status.aborted) {
        if (res && res.data) {
          const formData = {
            ...res.data,
            symptoms_onset_date: isoStringToDate(res.data.symptoms_onset_date),
            admission_date: isoStringToDate(res.data.admission_date),
            admitted: res.data.admitted ? String(res.data.admitted) : "false",
            admitted_to: res.data.admitted_to ? res.data.admitted_to : "",
            category: res.data.category
              ? PATIENT_CATEGORIES.find((i) => i.text === res.data.category)
                  ?.id || "Comfort"
              : "Comfort",
            ip_no: res.data.ip_no ? res.data.ip_no : "",
            verified_by: res.data.verified_by ? res.data.verified_by : "",
            OPconsultation: res.data.consultation_notes,
            is_telemedicine: `${res.data.is_telemedicine}`,
            is_kasp: `${res.data.is_kasp}`,
            assigned_to: res.data.assigned_to || "",
            ett_tt: res.data.ett_tt ? Number(res.data.ett_tt) : 3,
            special_instruction: res.data.special_instruction || "",
            weight: res.data.weight ? res.data.weight : "",
            height: res.data.height ? res.data.height : "",
            bed: res.data?.current_bed?.bed_object || null,
            discharge_reason: res.data?.discharge_reason || "",
            cause_of_death: res.data?.discharge_notes || "",
            death_datetime: res.data?.death_datetime || "",
            death_confirmed_doctor: res.data?.death_confirmed_doctor || "",
          };
          dispatch({ type: "set_form", form: formData });
          setBed(formData.bed);
        } else {
          goBack();
        }
        setIsLoading(false);
      }
    },
    [dispatchAction, id]
  );

  useAbortableEffect(
    (status: statusType) => {
      if (id) {
        fetchData(status);
      }
    },
    [dispatch, fetchData]
  );

  if (isLoading) return <Loading />;

  const validateForm = () => {
    const errors = { ...initError };
    let invalidForm = false;
    let error_div = "";

    Object.keys(state.form).forEach((field) => {
      switch (field) {
        case "symptoms":
          if (!state.form[field] || !state.form[field].length) {
            errors[field] = "Please select the symptoms";
            if (!error_div) error_div = field;
            invalidForm = true;
          }
          return;
        case "category":
          if (!state.form[field]) {
            errors[field] = "Please select a category";
            if (!error_div) error_div = field;
            invalidForm = true;
          }
          return;
        case "suggestion":
          if (!state.form[field]) {
            errors[field] = "Please enter the decision";
            if (!error_div) error_div = field;
            invalidForm = true;
          }
          return;
        case "consultation_status":
          if (!state.form[field]) {
            errors[field] = "Please select the consultation status";
            if (!error_div) error_div = field;
            invalidForm = true;
          }
          return;
        case "ip_no":
          if (state.form.suggestion !== "A") return;
          if (!state.form[field]) {
            errors[field] = "IP Number is required as person is admitted";
            if (!error_div) error_div = field;
            invalidForm = true;
          } else if (!state.form[field].replace(/\s/g, "").length) {
            errors[field] = "IP can not be empty";
            if (!error_div) error_div = field;
            invalidForm = true;
          }
          return;
        case "other_symptoms":
          if (isOtherSymptomsSelected && !state.form[field]) {
            errors[field] = "Please enter the other symptom details";
            if (!error_div) error_div = field;
            invalidForm = true;
          }
          return;
        case "symptoms_onset_date":
          if (hasSymptoms && !state.form[field]) {
            errors[field] = "Please enter date of onset of the above symptoms";
            if (!error_div) error_div = field;
            invalidForm = true;
          }
          return;
        case "admission_date":
          if (state.form.suggestion === "A" && !state.form[field]) {
            errors[field] = "Field is required as person is admitted";
            if (!error_div) error_div = field;
            invalidForm = true;
          }
          return;
        case "cause_of_death":
          if (state.form.suggestion === "DD" && !state.form[field]) {
            errors[field] = "Please enter cause of death";
            if (!error_div) error_div = field;
            invalidForm = true;
          }
          return;
        case "death_datetime":
          if (state.form.suggestion === "DD" && !state.form[field]) {
            errors[field] = "Please enter the date & time of death";
            if (!error_div) error_div = field;
            invalidForm = true;
          }
          return;
        case "death_confirmed_doctor":
          if (state.form.suggestion === "DD" && !state.form[field]) {
            errors[field] =
              "Please enter the name of doctor who confirmed the death";
            if (!error_div) error_div = field;
            invalidForm = true;
          }
          return;
        case "referred_to":
          if (state.form.suggestion === "R" && !state.form[field]) {
            errors[field] = "Please select the referred to facility";
            if (!error_div) error_div = field;
            invalidForm = true;
          }
          return;
        case "consultation_notes":
          if (!state.form[field]) {
            errors[field] = "Required *";
            if (!error_div) error_div = field;
            invalidForm = true;
          } else if (!state.form[field].replace(/\s/g, "").length) {
            errors[field] = "Consultation notes can not be empty";
            if (!error_div) error_div = field;
            invalidForm = true;
          }
          return;
        case "is_telemedicine":
          if (
            state.form.admitted_to === "Home Isolation" &&
            state.form[field] === "false"
          ) {
            errors[field] =
              "Telemedicine should be `Yes` when Admitted To is Home Isolation";
            if (!error_div) error_div = field;
            invalidForm = true;
          }
          return;
        case "is_kasp":
          if (!state.form[field]) {
            errors[
              field
            ] = `Please select an option, ${kasp_string} is mandatory`;
            if (!error_div) error_div = field;
            invalidForm = true;
          }
          return;
        case "discharge_advice": {
          let invalid = false;
          let errorMsg = "";
          for (const f of dischargeAdvice) {
            if (!f.medicine?.replace(/\s/g, "").length) {
              invalid = true;
              errorMsg = "Prescription Medicine field can not be empty";
              break;
            }
            if (!f.dosage?.replace(/\s/g, "").length) {
              invalid = true;
              errorMsg = "Prescription Frequency field can not be empty";
              break;
            }
          }
          if (invalid) {
            errors[field] = errorMsg;
            if (!error_div) error_div = field;
            invalidForm = true;
          }
          return;
        }
        case "procedure": {
          for (const p of procedures) {
            if (!p.procedure?.replace(/\s/g, "").length) {
              errors[field] = "Procedure field can not be empty";
              if (!error_div) error_div = field;
              invalidForm = true;
              break;
            }
            if (!p.repetitive && !p.time?.replace(/\s/g, "").length) {
              errors[field] = "Time field can not be empty";
              if (!error_div) error_div = field;
              invalidForm = true;
              break;
            }
            if (p.repetitive && !p.frequency?.replace(/\s/g, "").length) {
              errors[field] = "Frequency field can not be empty";
              if (!error_div) error_div = field;
              invalidForm = true;
              break;
            }
          }
          return;
        }
        case "prn_prescription": {
          for (const f of PRNAdvice) {
            if (!f.medicine?.replace(/\s/g, "").length) {
              errors[field] = "Medicine field can not be empty";
              if (!error_div) error_div = field;
              invalidForm = true;
              break;
            }
            if (!f.indicator?.replace(/\s/g, "").length) {
              errors[field] = "Indicator field can not be empty";
              if (!error_div) error_div = field;
              invalidForm = true;
              break;
            }
          }
          return;
        }

        case "investigation": {
          for (const i of InvestigationAdvice) {
            if (!i.type?.length) {
              errors[field] = "Investigation field can not be empty";
              if (!error_div) error_div = field;
              invalidForm = true;
              break;
            }
            if (i.repetitive && !i.frequency?.replace(/\s/g, "").length) {
              errors[field] = "Frequency field can not be empty";
              if (!error_div) error_div = field;
              invalidForm = true;
              break;
            }
          }
          return;
        }

        case "verified_by": {
          if (!state.form[field].replace(/\s/g, "").length) {
            errors[field] = "Please fill verified by";
            if (!error_div) error_div = field;
            invalidForm = true;
            break;
          }
          return;
        }

        case "icd11_provisional_diagnoses_object": {
          if (
            state.form[field].length === 0 &&
            state.form["icd11_diagnoses_object"].length === 0
          ) {
            for (const err_field of [field, "icd11_diagnoses_object"])
              errors[err_field] =
                "Please select either Provisional Diagnosis or Final Diagnosis";
            if (!error_div) error_div = field;
            invalidForm = true;
            break;
          }
          return;
        }

        default:
          return;
      }
    });
    dispatch({ type: "set_error", errors });
    return [!invalidForm, error_div];
  };

  const declareThePatientDead = async (
    cause_of_death: string,
    death_datetime: string,
    death_confirmed_doctor: string
  ) => {
    const dischargeResponse = await dispatchAction(
      dischargePatient(
        {
          discharge_reason: "EXP",
          discharge_notes: cause_of_death,
          death_datetime: death_datetime,
          death_confirmed_doctor: death_confirmed_doctor,
        },
        { id: patientId }
      )
    );

    if (dischargeResponse?.status === 200) {
      return dischargeResponse;
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const [validForm, error_div] = validateForm();

    if (!validForm) {
      scrollTo(error_div);
    } else {
      setIsLoading(true);
      const data = {
        symptoms: state.form.symptoms,
        other_symptoms: isOtherSymptomsSelected
          ? state.form.other_symptoms
          : undefined,
        symptoms_onset_date: hasSymptoms
          ? state.form.symptoms_onset_date
          : undefined,
        suggestion: state.form.suggestion,
        consultation_status: Number(state.form.consultation_status),
        admitted: state.form.suggestion === "A",
        admission_date:
          state.form.suggestion === "A" ? state.form.admission_date : undefined,
        category: state.form.category,
        is_kasp: state.form.is_kasp,
        kasp_enabled_date: JSON.parse(state.form.is_kasp) ? new Date() : null,
        examination_details: state.form.examination_details,
        history_of_present_illness: state.form.history_of_present_illness,
        prescribed_medication: state.form.prescribed_medication,
        discharge_date: state.form.discharge_date,
        ip_no: state.form.ip_no,
        icd11_diagnoses: state.form.icd11_diagnoses_object.map((o) => o.id),
        icd11_provisional_diagnoses:
          state.form.icd11_provisional_diagnoses_object.map((o) => o.id),
        verified_by: state.form.verified_by,
        discharge_advice: dischargeAdvice,
        prn_prescription: PRNAdvice,
        investigation: InvestigationAdvice,
        procedure: procedures,
        patient: patientId,
        facility: facilityId,
        referred_to:
          state.form.suggestion === "R" ? state.form.referred_to : undefined,
        consultation_notes: state.form.consultation_notes,
        is_telemedicine: state.form.is_telemedicine,
        action: state.form.action,
        review_interval: state.form.review_interval,
        assigned_to:
          state.form.is_telemedicine === "true" ? state.form.assigned_to : "",
        special_instruction: state.form.special_instruction,
        weight: Number(state.form.weight),
        height: Number(state.form.height),
        bed: bed && bed instanceof Array ? bed[0]?.id : bed?.id,
      };

      const res = await dispatchAction(
        id ? updateConsultation(id, data) : createConsultation(data)
      );
      setIsLoading(false);
      if (res && res.data && res.status !== 400) {
        dispatch({ type: "set_form", form: initForm });
        if (data.suggestion === "DD") {
          await declareThePatientDead(
            state.form.cause_of_death,
            state.form.death_datetime,
            state.form.death_confirmed_doctor
          );
        }
        if (id) {
          Notification.Success({
            msg: "Consultation updated successfully",
          });
          navigate(
            `/facility/${facilityId}/patient/${patientId}/consultation/${id}`
          );
        } else {
          Notification.Success({
            msg: "Consultation created successfully",
          });
          navigate(
            `/facility/${facilityId}/patient/${patientId}/consultation/${res.data.id}`
          );
        }
      }
    }
  };

  const handleFormFieldChange: FieldChangeEventHandler<unknown> = (event) => {
    dispatch({
      type: "set_form",
      form: { ...state.form, [event.name]: event.value },
    });
  };

  const handleTelemedicineChange: ChangeEventHandler<HTMLInputElement> = (
    e
  ) => {
    e &&
      e.target &&
      dispatch({
        type: "set_form",
        form: {
          ...state.form,
          [e.target.name]: e.target.value,
          action: e.target.value === "false" ? "PENDING" : state.form.action,
        },
      });
  };

  const handleDoctorSelect = (doctor: UserModel | null) => {
    if (doctor?.id) {
      dispatch({
        type: "set_form",
        form: {
          ...state.form,
          assigned_to: doctor.id.toString(),
          assigned_to_object: doctor,
        },
      });
    } else {
      dispatch({
        type: "set_form",
        form: {
          ...state.form,
          assigned_to: "",
          assigned_to_object: null,
        },
      });
    }
  };

  const setFacility = (selected: FacilityModel | FacilityModel[] | null) => {
    const selectedFacility = selected as FacilityModel;
    setSelectedFacility(selectedFacility);
    const form: FormDetails = { ...state.form };
    if (selectedFacility && selectedFacility.id) {
      form.referred_to = selectedFacility.id.toString() || "";
    }
    dispatch({ type: "set_form", form });
  };

  const field = (name: string) => {
    return {
      id: name,
      name,
      value: (state.form as any)[name],
      error: state.errors[name],
      onChange: handleFormFieldChange,
    };
  };

  const selectField = (name: string) => {
    return {
      ...field(name),
      optionValue: (option: any) => option.id,
      optionLabel: (option: any) => option.text,
      optionDescription: (option: any) => option.desc,
    };
  };

  return (
    <div ref={topRef}>
      <PageTitle
        className="ml-3 mt-5"
        title={isUpdate ? "Edit Consultation" : "Create Consultation"}
        crumbsReplacements={{
          [facilityId]: { name: facilityName },
          [patientId]: { name: patientName },
        }}
        backUrl={
          id
            ? `/facility/${facilityId}/patient/${patientId}/consultation/${id}`
            : `/facility/${facilityId}/patient/${patientId}`
        }
      />

      <form
        className="mt-10 bg-white rounded px-8 md:px-16 py-5 md:py-11 max-w-3xl mx-auto flex flex-col gap-4"
        onSubmit={handleSubmit}
      >
        <SymptomsSelect required label="Symptoms" {...field("symptoms")} />

        {isOtherSymptomsSelected && (
          <TextAreaFormField
            {...field("other_symptoms")}
            label="Other symptom details"
            required
            placeholder="Enter details of other symptoms here"
          />
        )}

        {hasSymptoms && (
          <DateFormField
            {...field("symptoms_onset_date")}
            disableFuture
            required
            label="Date of onset of the symptoms"
            position="LEFT"
          />
        )}

        <TextAreaFormField
          {...field("history_of_present_illness")}
          label="History of present illness"
          placeholder="Optional information"
        />

        <TextAreaFormField
          {...field("examination_details")}
          label="Examination details and Clinical conditions"
          placeholder="Optional information"
        />

        <TextAreaFormField
          {...field("prescribed_medication")}
          label="Treatment Plan / Treatment Summary"
          placeholder="Optional information"
        />

        <PatientCategorySelect
          required
          label="Category"
          {...field("category")}
        />

        <SelectFormField
          required
          label="Decision after consultation"
          {...selectField("suggestion")}
          options={CONSULTATION_SUGGESTION}
        />

        <SelectFormField
          required
          label="Status during the consultation"
          {...selectField("consultation_status")}
          options={CONSULTATION_STATUS}
        />

        {state.form.suggestion === "R" && (
          <div id="referred_to">
            <FieldLabel>Referred To Facility</FieldLabel>
            <FacilitySelect
              name="referred_to"
              searchAll={true}
              selected={selectedFacility}
              setSelected={setFacility}
              errors={state.errors.referred_to}
            />
          </div>
        )}

        {state.form.suggestion === "DD" && (
          <>
            <div id="cause_of_death">
              <TextAreaFormField
                {...field("cause_of_death")}
                required={state.form.suggestion === "DD"}
                label="Cause of Death"
                value={state.form.cause_of_death}
              />
            </div>
            <div id="death_datetime">
              <TextFormField
                {...field("death_datetime")}
                type="datetime-local"
                required={state.form.suggestion === "DD"}
                label="Date & Time of Death"
                value={state.form.death_datetime}
              />
            </div>
            <div id="death_confirmed_doctor">
              <TextAreaFormField
                {...field("death_confirmed_doctor")}
                required={state.form.suggestion === "DD"}
                label="Death Confirmed by"
                value={state.form.death_confirmed_doctor}
              />
            </div>
          </>
        )}

        {state.form.suggestion === "A" && (
          <>
            <DateFormField
              {...field("admission_date")}
              required
              label="Admission date"
              position="LEFT"
            />

            {!isUpdate && (
              <div>
                <FieldLabel>Bed</FieldLabel>
                <BedSelect
                  name="bed"
                  setSelected={setBed}
                  selected={bed}
                  error=""
                  multiple={false}
                  unoccupiedOnly={true}
                  facility={facilityId}
                />
              </div>
            )}
          </>
        )}

        <TextAreaFormField
          label="General Instructions (Advice)"
          required
          placeholder="Consultation Notes"
          {...field("consultation_notes")}
        />

        <div id="investigation">
          <FieldLabel>Investigation Suggestions</FieldLabel>
          <InvestigationBuilder
            investigations={InvestigationAdvice}
            setInvestigations={setInvestigationAdvice}
          />
          <ErrorHelperText error={state.errors.investigation} />
        </div>

        <div id="discharge_advice">
          <FieldLabel>Prescription Medication</FieldLabel>
          <PrescriptionBuilder
            prescriptions={dischargeAdvice}
            setPrescriptions={setDischargeAdvice}
          />
          <ErrorHelperText error={state.errors.discharge_advice} />
        </div>

        <div id="prn_prescription">
          <FieldLabel>PRN Prescription</FieldLabel>
          <PRNPrescriptionBuilder
            prescriptions={PRNAdvice}
            setPrescriptions={setPRNAdvice}
          />
          <ErrorHelperText error={state.errors.prn_prescription} />
        </div>

        <div id="procedure">
          <FieldLabel>Procedures</FieldLabel>
          <ProcedureBuilder
            procedures={procedures}
            setProcedures={setProcedures}
          />
          <ErrorHelperText error={state.errors.procedure} />
        </div>

        <TextFormField
          {...field("ip_no")}
          label="IP Number"
          required={state.form.suggestion === "A"}
        />

        <TextAreaFormField
          {...field("verified_by")}
          label="Verified by"
          required
          placeholder="Attending Doctors Name and Designation"
        />

        <DiagnosisSelectFormField
          {...field("icd11_provisional_diagnoses_object")}
          multiple
          label="Provisional Diagnosis (as per ICD-11 recommended by WHO)"
        />

        <DiagnosisSelectFormField
          {...field("icd11_diagnoses_object")}
          multiple
          label="Diagnosis (as per ICD-11 recommended by WHO)"
        />

        {kasp_enabled && (
          <div className="flex-1" id="is_kasp">
            <FieldLabel required>{kasp_string}</FieldLabel>
            <RadioGroup
              aria-label="covid"
              name="is_kasp"
              value={state.form.is_kasp}
              onChange={handleTelemedicineChange}
              style={{ padding: "0px 5px" }}
            >
              <Box display="flex" flexDirection="row">
                <FormControlLabel
                  value="true"
                  control={<Radio />}
                  label="Yes"
                />
                <FormControlLabel
                  value="false"
                  control={<Radio />}
                  label="No"
                />
              </Box>
            </RadioGroup>
            <ErrorHelperText error={state.errors.is_kasp} />
          </div>
        )}

        {/* Telemedicine Fields */}
        <div id="is_telemedicine">
          <FieldLabel>Telemedicine</FieldLabel>
          <RadioGroup
            aria-label="covid"
            name="is_telemedicine"
            value={state.form.is_telemedicine}
            onChange={handleTelemedicineChange}
            style={{ padding: "0px 5px" }}
          >
            <Box display="flex" flexDirection="row">
              <FormControlLabel value="true" control={<Radio />} label="Yes" />
              <FormControlLabel value="false" control={<Radio />} label="No" />
            </Box>
          </RadioGroup>
          <ErrorHelperText error={state.errors.is_telemedicine} />
        </div>

        {JSON.parse(state.form.is_telemedicine) && (
          <div className="flex flex-col md:flex-row justify-between gap-3">
            <SelectFormField
              {...selectField("review_interval")}
              label="Review After"
              options={REVIEW_AT_CHOICES}
            />

            <div className="flex-1">
              <OnlineUsersSelect
                userId={state.form.assigned_to}
                selectedUser={state.form.assigned_to_object}
                onSelect={handleDoctorSelect}
                user_type="Doctor"
                outline
              />
            </div>

            <SelectFormField
              className="flex-1"
              {...field("action")}
              label="Action"
              required
              options={TELEMEDICINE_ACTIONS}
              optionLabel={(option) => option.desc}
              optionValue={(option) => option.text}
            />
          </div>
        )}

        <TextAreaFormField
          label="Special Instructions"
          placeholder="Optional information"
          {...field("special_instruction")}
        />

        <div>
          <div className="flex flex-col md:flex-row gap-3">
            <TextFormField
              {...field("weight")}
              label="Weight (kg)"
              placeholder="kg"
            />
            <TextFormField
              {...field("height")}
              label="Height (cm)"
              placeholder="cm"
            />
          </div>
          <div id="body_surface" className="flex-1">
            Body Surface area :{" "}
            {Math.sqrt(
              (Number(state.form.weight) * Number(state.form.height)) / 3600
            ).toFixed(2)}{" "}
            m<sup>2</sup>
          </div>
        </div>
        {/* End of Telemedicine fields */}

        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-end">
          <Cancel
            onClick={() =>
              navigate(`/facility/${facilityId}/patient/${patientId}`)
            }
          />
          <Submit
            onClick={handleSubmit}
            label={isUpdate ? "Update Consultation" : "Create Consultation"}
          />
        </div>
      </form>

      {isUpdate && (
        <div className="mt-4 bg-white rounded max-w-3xl px-11 py-8 mx-auto">
          <h4>Update Bed</h4>
          <div className="py-11 px-6">
            <Beds
              facilityId={facilityId}
              patientId={patientId}
              consultationId={id}
              fetchPatientData={fetchData}
            />
          </div>
        </div>
      )}
    </div>
  );
};
