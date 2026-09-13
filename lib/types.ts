export interface Consultation {
  id: string;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
  mobile: string;
  address: string | null;
  medical_conditions: string[];
  treatment_name: string;
  been_to_salon: boolean;
  patch_test_status: boolean;
  no_patch_consent: boolean | null;
  recipient_name: string;
  signed_date: string;
  signature_path: string;
}

export interface ConsultationInput {
  first_name: string;
  last_name: string;
  email: string;
  mobile: string;
  address: string;
  medical_conditions: string[];
  treatment_name: string;
  been_to_salon: boolean;
  patch_test_status: boolean;
  no_patch_consent: boolean | null;
  recipient_name: string;
  signed_date: string;
}
