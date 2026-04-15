export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_cc_contacts: {
        Row: {
          actif: boolean
          created_at: string
          email: string
          id: string
          nom: string
          position: number
        }
        Insert: {
          actif?: boolean
          created_at?: string
          email: string
          id?: string
          nom: string
          position?: number
        }
        Update: {
          actif?: boolean
          created_at?: string
          email?: string
          id?: string
          nom?: string
          position?: number
        }
        Relationships: []
      }
      admin_email_config: {
        Row: {
          created_at: string
          from_email: string
          from_name: string
          id: string
          reply_to: string | null
          signature_html: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          from_email?: string
          from_name?: string
          id?: string
          reply_to?: string | null
          signature_html?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          from_email?: string
          from_name?: string
          id?: string
          reply_to?: string | null
          signature_html?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_logs: {
        Row: {
          action: string
          agent: string
          created_at: string
          date_validation: string | null
          decision_rationale: string | null
          deployment_id: string | null
          id: string
          input_data: Json
          output_data: Json
          sinistre_id: string | null
          valide_par: string | null
        }
        Insert: {
          action: string
          agent: string
          created_at?: string
          date_validation?: string | null
          decision_rationale?: string | null
          deployment_id?: string | null
          id?: string
          input_data?: Json
          output_data?: Json
          sinistre_id?: string | null
          valide_par?: string | null
        }
        Update: {
          action?: string
          agent?: string
          created_at?: string
          date_validation?: string | null
          decision_rationale?: string | null
          deployment_id?: string | null
          id?: string
          input_data?: Json
          output_data?: Json
          sinistre_id?: string | null
          valide_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_logs_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_logs_sinistre_id_fkey"
            columns: ["sinistre_id"]
            isOneToOne: false
            referencedRelation: "sinistres"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          cle: string
          updated_at: string | null
          valeur: string
        }
        Insert: {
          cle: string
          updated_at?: string | null
          valeur?: string
        }
        Update: {
          cle?: string
          updated_at?: string | null
          valeur?: string
        }
        Relationships: []
      }
      assignations: {
        Row: {
          benevole_id: string
          confirme_par_reserviste: boolean
          contact_responsable: string | null
          contact_telephone: string | null
          created_at: string
          date_confirmation: string | null
          date_debut: string
          date_fin: string
          directives: string | null
          id: string
          point_rassemblement: string | null
          role: string | null
          statut: string
          vague_id: string
        }
        Insert: {
          benevole_id: string
          confirme_par_reserviste?: boolean
          contact_responsable?: string | null
          contact_telephone?: string | null
          created_at?: string
          date_confirmation?: string | null
          date_debut: string
          date_fin: string
          directives?: string | null
          id?: string
          point_rassemblement?: string | null
          role?: string | null
          statut?: string
          vague_id: string
        }
        Update: {
          benevole_id?: string
          confirme_par_reserviste?: boolean
          contact_responsable?: string | null
          contact_telephone?: string | null
          created_at?: string
          date_confirmation?: string | null
          date_debut?: string
          date_fin?: string
          directives?: string | null
          id?: string
          point_rassemblement?: string | null
          role?: string | null
          statut?: string
          vague_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignations_vague_id_fkey"
            columns: ["vague_id"]
            isOneToOne: false
            referencedRelation: "vagues"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_connexions: {
        Row: {
          benevole_id: string | null
          connecte_a: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          benevole_id?: string | null
          connecte_a?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          benevole_id?: string | null
          connecte_a?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_connexions_benevole_id_fkey"
            columns: ["benevole_id"]
            isOneToOne: false
            referencedRelation: "reservistes"
            referencedColumns: ["benevole_id"]
          },
          {
            foreignKeyName: "audit_connexions_benevole_id_fkey"
            columns: ["benevole_id"]
            isOneToOne: false
            referencedRelation: "reservistes_actifs"
            referencedColumns: ["benevole_id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by_email: string | null
          changed_by_user_id: string | null
          field_name: string | null
          full_snapshot: Json | null
          id: string
          new_value: Json | null
          old_value: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by_email?: string | null
          changed_by_user_id?: string | null
          field_name?: string | null
          full_snapshot?: Json | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by_email?: string | null
          changed_by_user_id?: string | null
          field_name?: string | null
          full_snapshot?: Json | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      audit_pages: {
        Row: {
          benevole_id: string | null
          id: string
          page: string
          user_id: string | null
          visite_a: string | null
        }
        Insert: {
          benevole_id?: string | null
          id?: string
          page: string
          user_id?: string | null
          visite_a?: string | null
        }
        Update: {
          benevole_id?: string | null
          id?: string
          page?: string
          user_id?: string | null
          visite_a?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_pages_benevole_id_fkey"
            columns: ["benevole_id"]
            isOneToOne: false
            referencedRelation: "reservistes"
            referencedColumns: ["benevole_id"]
          },
          {
            foreignKeyName: "audit_pages_benevole_id_fkey"
            columns: ["benevole_id"]
            isOneToOne: false
            referencedRelation: "reservistes_actifs"
            referencedColumns: ["benevole_id"]
          },
        ]
      }
      auth_logs: {
        Row: {
          auth_method: string | null
          created_at: string | null
          email: string | null
          event_type: string
          id: number
          ip_address: string | null
          metadata: Json | null
          page_visited: string | null
          telephone: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          auth_method?: string | null
          created_at?: string | null
          email?: string | null
          event_type: string
          id?: never
          ip_address?: string | null
          metadata?: Json | null
          page_visited?: string | null
          telephone?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          auth_method?: string | null
          created_at?: string | null
          email?: string | null
          event_type?: string
          id?: never
          ip_address?: string | null
          metadata?: Json | null
          page_visited?: string | null
          telephone?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      brouillons_courriels: {
        Row: {
          body_html: string | null
          created_at: string
          destinataires: Json | null
          id: string
          pieces_jointes: Json | null
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body_html?: string | null
          created_at?: string
          destinataires?: Json | null
          id?: string
          pieces_jointes?: Json | null
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body_html?: string | null
          created_at?: string
          destinataires?: Json | null
          id?: string
          pieces_jointes?: Json | null
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      certificats_a_trier: {
        Row: {
          assigne_at: string | null
          assigne_par: string | null
          benevole_id: string | null
          created_at: string | null
          date_courriel: string | null
          filename_original: string
          formation_benevole_id: string | null
          id: string
          match_status: string | null
          message_id: string | null
          note_admin: string | null
          sender_email: string
          sender_name: string | null
          source: string | null
          statut_tri: string | null
          storage_path: string
          subject: string | null
          thread_id: string | null
        }
        Insert: {
          assigne_at?: string | null
          assigne_par?: string | null
          benevole_id?: string | null
          created_at?: string | null
          date_courriel?: string | null
          filename_original: string
          formation_benevole_id?: string | null
          id?: string
          match_status?: string | null
          message_id?: string | null
          note_admin?: string | null
          sender_email: string
          sender_name?: string | null
          source?: string | null
          statut_tri?: string | null
          storage_path: string
          subject?: string | null
          thread_id?: string | null
        }
        Update: {
          assigne_at?: string | null
          assigne_par?: string | null
          benevole_id?: string | null
          created_at?: string | null
          date_courriel?: string | null
          filename_original?: string
          formation_benevole_id?: string | null
          id?: string
          match_status?: string | null
          message_id?: string | null
          note_admin?: string | null
          sender_email?: string
          sender_name?: string | null
          source?: string | null
          statut_tri?: string | null
          storage_path?: string
          subject?: string | null
          thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificats_a_trier_benevole_id_fkey"
            columns: ["benevole_id"]
            isOneToOne: false
            referencedRelation: "reservistes"
            referencedColumns: ["benevole_id"]
          },
          {
            foreignKeyName: "certificats_a_trier_benevole_id_fkey"
            columns: ["benevole_id"]
            isOneToOne: false
            referencedRelation: "reservistes_actifs"
            referencedColumns: ["benevole_id"]
          },
          {
            foreignKeyName: "certificats_a_trier_formation_benevole_id_fkey"
            columns: ["formation_benevole_id"]
            isOneToOne: false
            referencedRelation: "formations_benevoles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificats_a_trier_formation_benevole_id_fkey"
            columns: ["formation_benevole_id"]
            isOneToOne: false
            referencedRelation: "formations_benevoles_actives"
            referencedColumns: ["id"]
          },
        ]
      }
      ciblages: {
        Row: {
          ajoute_par: string | null
          ajoute_par_ia: boolean
          benevole_id: string
          created_at: string | null
          id: string
          niveau: string
          reference_id: string
          statut: string
          updated_at: string | null
        }
        Insert: {
          ajoute_par?: string | null
          ajoute_par_ia?: boolean
          benevole_id: string
          created_at?: string | null
          id?: string
          niveau: string
          reference_id: string
          statut?: string
          updated_at?: string | null
        }
        Update: {
          ajoute_par?: string | null
          ajoute_par_ia?: boolean
          benevole_id?: string
          created_at?: string | null
          id?: string
          niveau?: string
          reference_id?: string
          statut?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ciblages_ajoute_par_fkey"
            columns: ["ajoute_par"]
            isOneToOne: false
            referencedRelation: "reservistes"
            referencedColumns: ["benevole_id"]
          },
          {
            foreignKeyName: "ciblages_ajoute_par_fkey"
            columns: ["ajoute_par"]
            isOneToOne: false
            referencedRelation: "reservistes_actifs"
            referencedColumns: ["benevole_id"]
          },
          {
            foreignKeyName: "ciblages_benevole_id_fkey"
            columns: ["benevole_id"]
            isOneToOne: false
            referencedRelation: "reservistes"
            referencedColumns: ["benevole_id"]
          },
          {
            foreignKeyName: "ciblages_benevole_id_fkey"
            columns: ["benevole_id"]
            isOneToOne: false
            referencedRelation: "reservistes_actifs"
            referencedColumns: ["benevole_id"]
          },
        ]
      }
      community_last_seen: {
        Row: {
          last_seen_at: string | null
          user_id: string
        }
        Insert: {
          last_seen_at?: string | null
          user_id: string
        }
        Update: {
          last_seen_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      courriel_campagnes: {
        Row: {
          body_html: string
          created_at: string
          envoye_par: string
          id: string
          nom: string
          subject: string
          total_envoyes: number
        }
        Insert: {
          body_html: string
          created_at?: string
          envoye_par: string
          id?: string
          nom: string
          subject: string
          total_envoyes?: number
        }
        Update: {
          body_html?: string
          created_at?: string
          envoye_par?: string
          id?: string
          nom?: string
          subject?: string
          total_envoyes?: number
        }
        Relationships: []
      }
      courriel_events: {
        Row: {
          courriel_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          courriel_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          courriel_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "courriel_events_courriel_id_fkey"
            columns: ["courriel_id"]
            isOneToOne: false
            referencedRelation: "courriels"
            referencedColumns: ["id"]
          },
        ]
      }
      courriel_reponses: {
        Row: {
          benevole_id: string | null
          body_html: string | null
          body_text: string | null
          courriel_id: string | null
          created_at: string
          from_email: string
          from_name: string | null
          id: string
          lu_at: string | null
          lu_par: string | null
          pieces_jointes: Json | null
          raw_payload: Json | null
          resend_email_id: string | null
          statut: string
          subject: string | null
          to_email: string | null
        }
        Insert: {
          benevole_id?: string | null
          body_html?: string | null
          body_text?: string | null
          courriel_id?: string | null
          created_at?: string
          from_email: string
          from_name?: string | null
          id?: string
          lu_at?: string | null
          lu_par?: string | null
          pieces_jointes?: Json | null
          raw_payload?: Json | null
          resend_email_id?: string | null
          statut?: string
          subject?: string | null
          to_email?: string | null
        }
        Update: {
          benevole_id?: string | null
          body_html?: string | null
          body_text?: string | null
          courriel_id?: string | null
          created_at?: string
          from_email?: string
          from_name?: string | null
          id?: string
          lu_at?: string | null
          lu_par?: string | null
          pieces_jointes?: Json | null
          raw_payload?: Json | null
          resend_email_id?: string | null
          statut?: string
          subject?: string | null
          to_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courriel_reponses_benevole_id_fkey"
            columns: ["benevole_id"]
            isOneToOne: false
            referencedRelation: "reservistes"
            referencedColumns: ["benevole_id"]
          },
          {
            foreignKeyName: "courriel_reponses_benevole_id_fkey"
            columns: ["benevole_id"]
            isOneToOne: false
            referencedRelation: "reservistes_actifs"
            referencedColumns: ["benevole_id"]
          },
          {
            foreignKeyName: "courriel_reponses_courriel_id_fkey"
            columns: ["courriel_id"]
            isOneToOne: false
            referencedRelation: "courriels"
            referencedColumns: ["id"]
          },
        ]
      }
      courriels: {
        Row: {
          benevole_id: string
          body_html: string
          campagne_id: string | null
          clics_count: number
          created_at: string
          envoye_par: string
          from_email: string
          from_name: string
          has_reply: boolean | null
          id: string
          ouvert_at: string | null
          pieces_jointes: Json | null
          resend_id: string | null
          statut: string
          subject: string
          to_email: string
        }
        Insert: {
          benevole_id: string
          body_html: string
          campagne_id?: string | null
          clics_count?: number
          created_at?: string
          envoye_par: string
          from_email: string
          from_name: string
          has_reply?: boolean | null
          id?: string
          ouvert_at?: string | null
          pieces_jointes?: Json | null
          resend_id?: string | null
          statut?: string
          subject: string
          to_email: string
        }
        Update: {
          benevole_id?: string
          body_html?: string
          campagne_id?: string | null
          clics_count?: number
          created_at?: string
          envoye_par?: string
          from_email?: string
          from_name?: string
          has_reply?: boolean | null
          id?: string
          ouvert_at?: string | null
          pieces_jointes?: Json | null
          resend_id?: string | null
          statut?: string
          subject?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "courriels_benevole_id_fkey"
            columns: ["benevole_id"]
            isOneToOne: false
            referencedRelation: "reservistes"
            referencedColumns: ["benevole_id"]
          },
          {
            foreignKeyName: "courriels_benevole_id_fkey"
            columns: ["benevole_id"]
            isOneToOne: false
            referencedRelation: "reservistes_actifs"
            referencedColumns: ["benevole_id"]
          },
          {
            foreignKeyName: "courriels_campagne_fk"
            columns: ["campagne_id"]
            isOneToOne: false
            referencedRelation: "courriel_campagnes"
            referencedColumns: ["id"]
          },
        ]
      }
      demandes: {
        Row: {
          competences_requises: string[] | null
          contact_email: string | null
          contact_nom: string | null
          contact_telephone: string | null
          contact_titre: string | null
          created_at: string
          date_debut: string
          date_fin_estimee: string | null
          date_reception: string
          description: string
          id: string
          identifiant: string
          latitude: number | null
          lieu: string
          longitude: number | null
          monday_id: string | null
          nb_personnes_requis: number | null
          organisme: string
          organisme_detail: string | null
          priorite: string
          sinistre_id: string
          statut: string
          type_mission: string
          type_mission_detail: string | null
          updated_at: string
        }
        Insert: {
          competences_requises?: string[] | null
          contact_email?: string | null
          contact_nom?: string | null
          contact_telephone?: string | null
          contact_titre?: string | null
          created_at?: string
          date_debut: string
          date_fin_estimee?: string | null
          date_reception?: string
          description: string
          id?: string
          identifiant: string
          latitude?: number | null
          lieu: string
          longitude?: number | null
          monday_id?: string | null
          nb_personnes_requis?: number | null
          organisme: string
          organisme_detail?: string | null
          priorite?: string
          sinistre_id: string
          statut?: string
          type_mission: string
          type_mission_detail?: string | null
          updated_at?: string
        }
        Update: {
          competences_requises?: string[] | null
          contact_email?: string | null
          contact_nom?: string | null
          contact_telephone?: string | null
          contact_titre?: string | null
          created_at?: string
          date_debut?: string
          date_fin_estimee?: string | null
          date_reception?: string
          description?: string
          id?: string
          identifiant?: string
          latitude?: number | null
          lieu?: string
          longitude?: number | null
          monday_id?: string | null
          nb_personnes_requis?: number | null
          organisme?: string
          organisme_detail?: string | null
          priorite?: string
          sinistre_id?: string
          statut?: string
          type_mission?: string
          type_mission_detail?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demandes_sinistre_id_fkey"
            columns: ["sinistre_id"]
            isOneToOne: false
            referencedRelation: "sinistres"
            referencedColumns: ["id"]
          },
        ]
      }
      deploiements_actifs: {
        Row: {
          created_at: string | null
          date_debut: string | null
          date_fin: string | null
          date_limite_reponse: string | null
          deploiement_id: string
          id: string
          lieu: string | null
          monday_item_id: string | null
          nom_demande: string | null
          nom_deploiement: string
          nom_sinistre: string | null
          organisme: string | null
          statut: string | null
          tache: string | null
          type_incident: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date_debut?: string | null
          date_fin?: string | null
          date_limite_reponse?: string | null
          deploiement_id: string
          id?: string
          lieu?: string | null
          monday_item_id?: string | null
          nom_demande?: string | null
          nom_deploiement: string
          nom_sinistre?: string | null
          organisme?: string | null
          statut?: string | null
          tache?: string | null
          type_incident?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date_debut?: string | null
          date_fin?: string | null
          date_limite_reponse?: string | null
          deploiement_id?: string
          id?: string
          lieu?: string | null
          monday_item_id?: string | null
          nom_demande?: string | null
          nom_deploiement?: string
          nom_sinistre?: string | null
          organisme?: string | null
          statut?: string | null
          tache?: string | null
          type_incident?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      deployments: {
        Row: {
          created_at: string
          date_debut: string
          date_fin: string | null
          demande_id: string | null
          hebergement: string | null
          id: string
          identifiant: string
          latitude: number | null
          lieu: string
          longitude: number | null
          monday_id: string | null
          nb_personnes_par_vague: number
          nom: string
          notes_logistique: string | null
          point_rassemblement: string | null
          statut: string
          transport: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_debut: string
          date_fin?: string | null
          demande_id?: string | null
          hebergement?: string | null
          id?: string
          identifiant: string
          latitude?: number | null
          lieu: string
          longitude?: number | null
          monday_id?: string | null
          nb_personnes_par_vague: number
          nom: string
          notes_logistique?: string | null
          point_rassemblement?: string | null
          statut?: string
          transport?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_debut?: string
          date_fin?: string | null
          demande_id?: string | null
          hebergement?: string | null
          id?: string
          identifiant?: string
          latitude?: number | null
          lieu?: string
          longitude?: number | null
          monday_id?: string | null
          nb_personnes_par_vague?: number
          nom?: string
          notes_logistique?: string | null
          point_rassemblement?: string | null
          statut?: string
          transport?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deployments_demande_id_fkey"
            columns: ["demande_id"]
            isOneToOne: false
            referencedRelation: "demandes"
            referencedColumns: ["id"]
          },
        ]
      }
      deployments_demandes: {
        Row: {
          demande_id: string
          deployment_id: string
        }
        Insert: {
          demande_id: string
          deployment_id: string
        }
        Update: {
          demande_id?: string
          deployment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deployments_demandes_demande_id_fkey"
            columns: ["demande_id"]
            isOneToOne: false
            referencedRelation: "demandes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployments_demandes_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
        ]
      }
      disponibilites: {
        Row: {
          benevole_id: string | null
          commentaire: string | null
          created_at: string
          date_debut: string | null
          date_fin: string | null
          deploiement_id: string | null
          envoye_le: string | null
          id: number
          monday_item_id: string | null
          nom_demande: string | null
          nom_deploiement: string | null
          nom_sinistre: string | null
          organisme_demande: string | null
          repondu_le: string | null
          statut: string | null
          statut_version: string | null
          transport: string | null
          user_id: string | null
        }
        Insert: {
          benevole_id?: string | null
          commentaire?: string | null
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          deploiement_id?: string | null
          envoye_le?: string | null
          id?: number
          monday_item_id?: string | null
          nom_demande?: string | null
          nom_deploiement?: string | null
          nom_sinistre?: string | null
          organisme_demande?: string | null
          repondu_le?: string | null
          statut?: string | null
          statut_version?: string | null
          transport?: string | null
          user_id?: string | null
        }
        Update: {
          benevole_id?: string | null
          commentaire?: string | null
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          deploiement_id?: string | null
          envoye_le?: string | null
          id?: number
          monday_item_id?: string | null
          nom_demande?: string | null
          nom_deploiement?: string | null
          nom_sinistre?: string | null
          organisme_demande?: string | null
          repondu_le?: string | null
          statut?: string | null
          statut_version?: string | null
          transport?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      disponibilites_v2: {
        Row: {
          a_confirmer: boolean
          benevole_id: string
          commentaire: string | null
          created_at: string
          date_jour: string
          deployment_id: string
          disponible: boolean
          id: string
        }
        Insert: {
          a_confirmer?: boolean
          benevole_id: string
          commentaire?: string | null
          created_at?: string
          date_jour: string
          deployment_id: string
          disponible: boolean
          id?: string
        }
        Update: {
          a_confirmer?: boolean
          benevole_id?: string
          commentaire?: string | null
          created_at?: string
          date_jour?: string
          deployment_id?: string
          disponible?: boolean
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disponibilites_v2_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
        ]
      }
      documents_officiels: {
        Row: {
          benevole_id: string
          chemin_storage: string
          created_at: string | null
          date_creation: string | null
          id: number
          nom_fichier: string
          titre: string
          type_document: string
          url_public: string | null
        }
        Insert: {
          benevole_id: string
          chemin_storage: string
          created_at?: string | null
          date_creation?: string | null
          id?: number
          nom_fichier: string
          titre: string
          type_document: string
          url_public?: string | null
        }
        Update: {
          benevole_id?: string
          chemin_storage?: string
          created_at?: string | null
          date_creation?: string | null
          id?: number
          nom_fichier?: string
          titre?: string
          type_document?: string
          url_public?: string | null
        }
        Relationships: []
      }
      dossier_reserviste: {
        Row: {
          adresse_code_postal: string | null
          adresse_province: string | null
          adresse_rue: string | null
          adresse_ville: string | null
          allergies_alimentaires: string[] | null
          allergies_autres: string | null
          autres_competences: string | null
          benevole_id: string
          certificat_premiers_soins: string[] | null
          certification_csi: string[] | null
          commentaire: string | null
          communication: string[] | null
          competence_rs: string[] | null
          competences_securite: string[] | null
          confidentialite: string | null
          created_at: string | null
          disponibilite_generale: string | null
          disponibilite_urgence: boolean | null
          email: string | null
          equipe_canine: string[] | null
          groupe_sanguin: string | null
          id: string
          navire_marin: string[] | null
          nom: string | null
          permis_conduire: string[] | null
          prenom: string | null
          problemes_sante: string | null
          satp_drone: string[] | null
          synced_from_monday_at: string | null
          synced_to_monday_at: string | null
          telephone: string | null
          updated_at: string | null
          user_id: string | null
          vehicule_tout_terrain: string[] | null
        }
        Insert: {
          adresse_code_postal?: string | null
          adresse_province?: string | null
          adresse_rue?: string | null
          adresse_ville?: string | null
          allergies_alimentaires?: string[] | null
          allergies_autres?: string | null
          autres_competences?: string | null
          benevole_id: string
          certificat_premiers_soins?: string[] | null
          certification_csi?: string[] | null
          commentaire?: string | null
          communication?: string[] | null
          competence_rs?: string[] | null
          competences_securite?: string[] | null
          confidentialite?: string | null
          created_at?: string | null
          disponibilite_generale?: string | null
          disponibilite_urgence?: boolean | null
          email?: string | null
          equipe_canine?: string[] | null
          groupe_sanguin?: string | null
          id?: string
          navire_marin?: string[] | null
          nom?: string | null
          permis_conduire?: string[] | null
          prenom?: string | null
          problemes_sante?: string | null
          satp_drone?: string[] | null
          synced_from_monday_at?: string | null
          synced_to_monday_at?: string | null
          telephone?: string | null
          updated_at?: string | null
          user_id?: string | null
          vehicule_tout_terrain?: string[] | null
        }
        Update: {
          adresse_code_postal?: string | null
          adresse_province?: string | null
          adresse_rue?: string | null
          adresse_ville?: string | null
          allergies_alimentaires?: string[] | null
          allergies_autres?: string | null
          autres_competences?: string | null
          benevole_id?: string
          certificat_premiers_soins?: string[] | null
          certification_csi?: string[] | null
          commentaire?: string | null
          communication?: string[] | null
          competence_rs?: string[] | null
          competences_securite?: string[] | null
          confidentialite?: string | null
          created_at?: string | null
          disponibilite_generale?: string | null
          disponibilite_urgence?: boolean | null
          email?: string | null
          equipe_canine?: string[] | null
          groupe_sanguin?: string | null
          id?: string
          navire_marin?: string[] | null
          nom?: string | null
          permis_conduire?: string[] | null
          prenom?: string | null
          problemes_sante?: string | null
          satp_drone?: string[] | null
          synced_from_monday_at?: string | null
          synced_to_monday_at?: string | null
          telephone?: string | null
          updated_at?: string | null
          user_id?: string | null
          vehicule_tout_terrain?: string[] | null
        }
        Relationships: []
      }
      formations_benevoles: {
        Row: {
          a_expiration: boolean | null
          benevole_id: string | null
          certificat_requis: boolean | null
          certificat_url: string | null
          certificat_url_archive: string | null
          commentaire: string | null
          competence_profil_champ: string | null
          competence_profil_label: string | null
          created_at: string | null
          date_expiration: string | null
          date_reussite: string | null
          deleted_at: string | null
          deleted_by_user_id: string | null
          deleted_reason: string | null
          etat_validite: string | null
          id: string
          initiation_sc_completee: boolean | null
          monday_item_id: number | null
          nom_complet: string | null
          nom_formation: string | null
          resultat: string | null
          role: string | null
          source: string | null
          unite: number | null
          updated_at: string | null
        }
        Insert: {
          a_expiration?: boolean | null
          benevole_id?: string | null
          certificat_requis?: boolean | null
          certificat_url?: string | null
          certificat_url_archive?: string | null
          commentaire?: string | null
          competence_profil_champ?: string | null
          competence_profil_label?: string | null
          created_at?: string | null
          date_expiration?: string | null
          date_reussite?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deleted_reason?: string | null
          etat_validite?: string | null
          id?: string
          initiation_sc_completee?: boolean | null
          monday_item_id?: number | null
          nom_complet?: string | null
          nom_formation?: string | null
          resultat?: string | null
          role?: string | null
          source?: string | null
          unite?: number | null
          updated_at?: string | null
        }
        Update: {
          a_expiration?: boolean | null
          benevole_id?: string | null
          certificat_requis?: boolean | null
          certificat_url?: string | null
          certificat_url_archive?: string | null
          commentaire?: string | null
          competence_profil_champ?: string | null
          competence_profil_label?: string | null
          created_at?: string | null
          date_expiration?: string | null
          date_reussite?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deleted_reason?: string | null
          etat_validite?: string | null
          id?: string
          initiation_sc_completee?: boolean | null
          monday_item_id?: number | null
          nom_complet?: string | null
          nom_formation?: string | null
          resultat?: string | null
          role?: string | null
          source?: string | null
          unite?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      formations_benevoles_audit: {
        Row: {
          action: string
          benevole_id: string | null
          certificat_url_apres: string | null
          certificat_url_avant: string | null
          donnees_apres: Json | null
          donnees_avant: Json | null
          effectue_at: string | null
          effectue_par: string | null
          formation_id: string | null
          id: string
          nom_formation: string | null
          resultat_apres: string | null
          resultat_avant: string | null
        }
        Insert: {
          action: string
          benevole_id?: string | null
          certificat_url_apres?: string | null
          certificat_url_avant?: string | null
          donnees_apres?: Json | null
          donnees_avant?: Json | null
          effectue_at?: string | null
          effectue_par?: string | null
          formation_id?: string | null
          id?: string
          nom_formation?: string | null
          resultat_apres?: string | null
          resultat_avant?: string | null
        }
        Update: {
          action?: string
          benevole_id?: string | null
          certificat_url_apres?: string | null
          certificat_url_avant?: string | null
          donnees_apres?: Json | null
          donnees_avant?: Json | null
          effectue_at?: string | null
          effectue_par?: string | null
          formation_id?: string | null
          id?: string
          nom_formation?: string | null
          resultat_apres?: string | null
          resultat_avant?: string | null
        }
        Relationships: []
      }
      groupes_recherche: {
        Row: {
          actif: boolean | null
          created_at: string | null
          district: number
          id: string
          nom: string
        }
        Insert: {
          actif?: boolean | null
          created_at?: string | null
          district: number
          id?: string
          nom: string
        }
        Update: {
          actif?: boolean | null
          created_at?: string | null
          district?: number
          id?: string
          nom?: string
        }
        Relationships: []
      }
      inscriptions_camps: {
        Row: {
          benevole_id: string
          cahier_envoye: boolean | null
          camp_adresse: string | null
          camp_dates: string | null
          camp_lieu: string | null
          camp_nom: string | null
          courriel: string | null
          created_at: string | null
          id: string
          monday_item_id: string | null
          notification_sent_at: string | null
          notification_type: string | null
          prenom_nom: string
          presence: Database["public"]["Enums"]["presence_status"]
          presence_updated_at: string | null
          session_id: string
          sync_error: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          telephone: string | null
          updated_at: string | null
        }
        Insert: {
          benevole_id: string
          cahier_envoye?: boolean | null
          camp_adresse?: string | null
          camp_dates?: string | null
          camp_lieu?: string | null
          camp_nom?: string | null
          courriel?: string | null
          created_at?: string | null
          id?: string
          monday_item_id?: string | null
          notification_sent_at?: string | null
          notification_type?: string | null
          prenom_nom: string
          presence?: Database["public"]["Enums"]["presence_status"]
          presence_updated_at?: string | null
          session_id: string
          sync_error?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          telephone?: string | null
          updated_at?: string | null
        }
        Update: {
          benevole_id?: string
          cahier_envoye?: boolean | null
          camp_adresse?: string | null
          camp_dates?: string | null
          camp_lieu?: string | null
          camp_nom?: string | null
          courriel?: string | null
          created_at?: string | null
          id?: string
          monday_item_id?: string | null
          notification_sent_at?: string | null
          notification_type?: string | null
          prenom_nom?: string
          presence?: Database["public"]["Enums"]["presence_status"]
          presence_updated_at?: string | null
          session_id?: string
          sync_error?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          telephone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inscriptions_camps_logs: {
        Row: {
          benevole_id: string | null
          created_at: string | null
          id: string
          inscription_id: string
          modifie_par: string | null
          prenom_nom: string | null
          presence_apres: string | null
          presence_avant: string | null
          session_id: string | null
        }
        Insert: {
          benevole_id?: string | null
          created_at?: string | null
          id?: string
          inscription_id: string
          modifie_par?: string | null
          prenom_nom?: string | null
          presence_apres?: string | null
          presence_avant?: string | null
          session_id?: string | null
        }
        Update: {
          benevole_id?: string | null
          created_at?: string | null
          id?: string
          inscription_id?: string
          modifie_par?: string | null
          prenom_nom?: string | null
          presence_apres?: string | null
          presence_avant?: string | null
          session_id?: string | null
        }
        Relationships: []
      }
      langues: {
        Row: {
          created_at: string | null
          id: string
          nom: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nom: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nom?: string
        }
        Relationships: []
      }
      lms_modules: {
        Row: {
          actif: boolean | null
          activity_id: string | null
          bucket_path: string
          certificat: boolean | null
          created_at: string | null
          description: string | null
          groupes: string[] | null
          id: string
          ordre: number | null
          titre: string
          updated_at: string | null
        }
        Insert: {
          actif?: boolean | null
          activity_id?: string | null
          bucket_path: string
          certificat?: boolean | null
          created_at?: string | null
          description?: string | null
          groupes?: string[] | null
          id?: string
          ordre?: number | null
          titre: string
          updated_at?: string | null
        }
        Update: {
          actif?: boolean | null
          activity_id?: string | null
          bucket_path?: string
          certificat?: boolean | null
          created_at?: string | null
          description?: string | null
          groupes?: string[] | null
          id?: string
          ordre?: number | null
          titre?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lms_progression: {
        Row: {
          benevole_id: string
          created_at: string | null
          date_completion: string | null
          date_debut: string | null
          id: string
          module_id: string
          nb_tentatives: number | null
          progression_pct: number | null
          score: number | null
          statut: string | null
          updated_at: string | null
        }
        Insert: {
          benevole_id: string
          created_at?: string | null
          date_completion?: string | null
          date_debut?: string | null
          id?: string
          module_id: string
          nb_tentatives?: number | null
          progression_pct?: number | null
          score?: number | null
          statut?: string | null
          updated_at?: string | null
        }
        Update: {
          benevole_id?: string
          created_at?: string | null
          date_completion?: string | null
          date_debut?: string | null
          id?: string
          module_id?: string
          nb_tentatives?: number | null
          progression_pct?: number | null
          score?: number | null
          statut?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lms_progression_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "lms_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          benevole_id: string
          created_at: string | null
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          benevole_id: string
          created_at?: string | null
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          benevole_id?: string
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          auteur_nom: string | null
          auteur_photo: string | null
          benevole_id: string | null
          canal: string | null
          contenu: string
          created_at: string | null
          edited_at: string | null
          file_name: string | null
          id: string
          image_url: string | null
          is_deleted: boolean | null
          reply_to_id: string | null
          user_id: string | null
        }
        Insert: {
          auteur_nom?: string | null
          auteur_photo?: string | null
          benevole_id?: string | null
          canal?: string | null
          contenu: string
          created_at?: string | null
          edited_at?: string | null
          file_name?: string | null
          id?: string
          image_url?: string | null
          is_deleted?: boolean | null
          reply_to_id?: string | null
          user_id?: string | null
        }
        Update: {
          auteur_nom?: string | null
          auteur_photo?: string | null
          benevole_id?: string | null
          canal?: string | null
          contenu?: string
          created_at?: string | null
          edited_at?: string | null
          file_name?: string | null
          id?: string
          image_url?: string | null
          is_deleted?: boolean | null
          reply_to_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      municipalites_qc: {
        Row: {
          code_geo: string | null
          created_at: string | null
          designation: string | null
          id: number
          mrc: string | null
          municipalite: string
          region_administrative: string
        }
        Insert: {
          code_geo?: string | null
          created_at?: string | null
          designation?: string | null
          id?: number
          mrc?: string | null
          municipalite: string
          region_administrative: string
        }
        Update: {
          code_geo?: string | null
          created_at?: string | null
          designation?: string | null
          id?: number
          mrc?: string | null
          municipalite?: string
          region_administrative?: string
        }
        Relationships: []
      }
      notes_fichiers: {
        Row: {
          created_at: string
          id: string
          nom_fichier: string
          note_id: string
          storage_path: string
          taille: number | null
          type_mime: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nom_fichier: string
          note_id: string
          storage_path: string
          taille?: number | null
          type_mime?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nom_fichier?: string
          note_id?: string
          storage_path?: string
          taille?: number | null
          type_mime?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_fichiers_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes_reservistes"
            referencedColumns: ["id"]
          },
        ]
      }
      notes_reservistes: {
        Row: {
          auteur_id: string
          auteur_nom: string
          benevole_id: string
          contenu: string
          created_at: string
          id: string
          lu_par: string[]
        }
        Insert: {
          auteur_id: string
          auteur_nom: string
          benevole_id: string
          contenu: string
          created_at?: string
          id?: string
          lu_par?: string[]
        }
        Update: {
          auteur_id?: string
          auteur_nom?: string
          benevole_id?: string
          contenu?: string
          created_at?: string
          id?: string
          lu_par?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "notes_reservistes_benevole_id_fkey"
            columns: ["benevole_id"]
            isOneToOne: false
            referencedRelation: "reservistes"
            referencedColumns: ["benevole_id"]
          },
          {
            foreignKeyName: "notes_reservistes_benevole_id_fkey"
            columns: ["benevole_id"]
            isOneToOne: false
            referencedRelation: "reservistes_actifs"
            referencedColumns: ["benevole_id"]
          },
        ]
      }
      organisations: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          nom: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          nom: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          nom?: string
        }
        Relationships: []
      }
      rappels_camps: {
        Row: {
          benevole_id: string
          created_at: string | null
          envoye_at: string | null
          id: string
          inscription_id: string | null
          message_envoye: string
          reponse: string | null
          reponse_at: string | null
          reponse_confirmee: boolean | null
          session_id: string
          telephone: string
          twilio_message_sid: string | null
        }
        Insert: {
          benevole_id: string
          created_at?: string | null
          envoye_at?: string | null
          id?: string
          inscription_id?: string | null
          message_envoye: string
          reponse?: string | null
          reponse_at?: string | null
          reponse_confirmee?: boolean | null
          session_id: string
          telephone: string
          twilio_message_sid?: string | null
        }
        Update: {
          benevole_id?: string
          created_at?: string | null
          envoye_at?: string | null
          id?: string
          inscription_id?: string | null
          message_envoye?: string
          reponse?: string | null
          reponse_at?: string | null
          reponse_confirmee?: boolean | null
          session_id?: string
          telephone?: string
          twilio_message_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rappels_camps_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "inscriptions_camps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rappels_camps_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "inscriptions_camps_partenaire"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rappels_camps_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "v_inscriptions_portail"
            referencedColumns: ["id"]
          },
        ]
      }
      reserviste_etat: {
        Row: {
          benevole_id: string
          date_disponible: string | null
          date_retour: string | null
          deployment_actuel_id: string | null
          dernier_deploiement_date: string | null
          etat: string
          id: string
          jours_deployes_consecutifs: number
          jours_deployes_total_sinistre: number
          lieu_actuel: string | null
          nb_deploiements_annee: number
          updated_at: string
          vague_actuelle_id: string | null
        }
        Insert: {
          benevole_id: string
          date_disponible?: string | null
          date_retour?: string | null
          deployment_actuel_id?: string | null
          dernier_deploiement_date?: string | null
          etat?: string
          id?: string
          jours_deployes_consecutifs?: number
          jours_deployes_total_sinistre?: number
          lieu_actuel?: string | null
          nb_deploiements_annee?: number
          updated_at?: string
          vague_actuelle_id?: string | null
        }
        Update: {
          benevole_id?: string
          date_disponible?: string | null
          date_retour?: string | null
          deployment_actuel_id?: string | null
          dernier_deploiement_date?: string | null
          etat?: string
          id?: string
          jours_deployes_consecutifs?: number
          jours_deployes_total_sinistre?: number
          lieu_actuel?: string | null
          nb_deploiements_annee?: number
          updated_at?: string
          vague_actuelle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reserviste_etat_deployment_actuel_id_fkey"
            columns: ["deployment_actuel_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserviste_etat_vague_actuelle_id_fkey"
            columns: ["vague_actuelle_id"]
            isOneToOne: false
            referencedRelation: "vagues"
            referencedColumns: ["id"]
          },
        ]
      }
      reserviste_langues: {
        Row: {
          benevole_id: string
          created_at: string | null
          id: string
          langue_id: string | null
        }
        Insert: {
          benevole_id: string
          created_at?: string | null
          id?: string
          langue_id?: string | null
        }
        Update: {
          benevole_id?: string
          created_at?: string | null
          id?: string
          langue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reserviste_langues_langue_id_fkey"
            columns: ["langue_id"]
            isOneToOne: false
            referencedRelation: "langues"
            referencedColumns: ["id"]
          },
        ]
      }
      reserviste_organisations: {
        Row: {
          benevole_id: string
          created_at: string | null
          id: string
          organisation_id: string | null
        }
        Insert: {
          benevole_id: string
          created_at?: string | null
          id?: string
          organisation_id?: string | null
        }
        Update: {
          benevole_id?: string
          created_at?: string | null
          id?: string
          organisation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reserviste_organisations_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservistes: {
        Row: {
          adresse: string | null
          allergies_alimentaires: string | null
          allergies_autres: string | null
          antecedents_date_expiration: string | null
          antecedents_date_verification: string | null
          antecedents_statut: string
          autres_competences: string | null
          benevole_id: string
          camp_qualif_complete: boolean | null
          cartographie_sig: string[] | null
          certificat_premiers_soins: string[] | null
          certification_csi: string[] | null
          code_postal: string | null
          commentaire: string | null
          communication: string[] | null
          competence_rs: string[] | null
          competences_sauvetage: string[] | null
          competences_securite: string[] | null
          conditions_medicales: string | null
          confidentialite: boolean | null
          consent_photo: boolean | null
          consent_photos: boolean | null
          consentement_antecedents: boolean | null
          contact_urgence_courriel: string | null
          contact_urgence_lien: string | null
          contact_urgence_nom: string | null
          contact_urgence_telephone: string | null
          created_at: string
          date_expiration_certificat: string | null
          date_naissance: string | null
          deleted_at: string | null
          deleted_by_user_id: string | null
          deleted_reason: string | null
          disponible_covoiturage: string[] | null
          email: string
          equipe_canine: string[] | null
          experience_urgence_detail: string | null
          grandeur_bottes: string | null
          groupe: string
          groupe_recherche: string | null
          groupe_sanguin: string | null
          id: number
          j_ai_18_ans: boolean | null
          latitude: number | null
          longitude: number | null
          methode_connexion: string
          monday_created_at: string | null
          monday_group_id: string | null
          navire_marin: string[] | null
          niveau_ressource: number
          nom: string
          operation_urgence: string[] | null
          permis_conduire: string[] | null
          photo_url: string | null
          preference_tache: string | null
          preference_tache_commentaire: string | null
          prenom: string
          problemes_sante: string | null
          profession: string | null
          region: string | null
          remboursement_bottes_date: string | null
          responsable_groupe: boolean
          role: string
          satp_drone: string[] | null
          statut: string
          telephone: string | null
          telephone_secondaire: string | null
          updated_at: string
          user_id: string | null
          vehicule_tout_terrain: string[] | null
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          allergies_alimentaires?: string | null
          allergies_autres?: string | null
          antecedents_date_expiration?: string | null
          antecedents_date_verification?: string | null
          antecedents_statut?: string
          autres_competences?: string | null
          benevole_id: string
          camp_qualif_complete?: boolean | null
          cartographie_sig?: string[] | null
          certificat_premiers_soins?: string[] | null
          certification_csi?: string[] | null
          code_postal?: string | null
          commentaire?: string | null
          communication?: string[] | null
          competence_rs?: string[] | null
          competences_sauvetage?: string[] | null
          competences_securite?: string[] | null
          conditions_medicales?: string | null
          confidentialite?: boolean | null
          consent_photo?: boolean | null
          consent_photos?: boolean | null
          consentement_antecedents?: boolean | null
          contact_urgence_courriel?: string | null
          contact_urgence_lien?: string | null
          contact_urgence_nom?: string | null
          contact_urgence_telephone?: string | null
          created_at?: string
          date_expiration_certificat?: string | null
          date_naissance?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deleted_reason?: string | null
          disponible_covoiturage?: string[] | null
          email: string
          equipe_canine?: string[] | null
          experience_urgence_detail?: string | null
          grandeur_bottes?: string | null
          groupe?: string
          groupe_recherche?: string | null
          groupe_sanguin?: string | null
          id?: number
          j_ai_18_ans?: boolean | null
          latitude?: number | null
          longitude?: number | null
          methode_connexion?: string
          monday_created_at?: string | null
          monday_group_id?: string | null
          navire_marin?: string[] | null
          niveau_ressource?: number
          nom: string
          operation_urgence?: string[] | null
          permis_conduire?: string[] | null
          photo_url?: string | null
          preference_tache?: string | null
          preference_tache_commentaire?: string | null
          prenom: string
          problemes_sante?: string | null
          profession?: string | null
          region?: string | null
          remboursement_bottes_date?: string | null
          responsable_groupe?: boolean
          role?: string
          satp_drone?: string[] | null
          statut?: string
          telephone?: string | null
          telephone_secondaire?: string | null
          updated_at?: string
          user_id?: string | null
          vehicule_tout_terrain?: string[] | null
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          allergies_alimentaires?: string | null
          allergies_autres?: string | null
          antecedents_date_expiration?: string | null
          antecedents_date_verification?: string | null
          antecedents_statut?: string
          autres_competences?: string | null
          benevole_id?: string
          camp_qualif_complete?: boolean | null
          cartographie_sig?: string[] | null
          certificat_premiers_soins?: string[] | null
          certification_csi?: string[] | null
          code_postal?: string | null
          commentaire?: string | null
          communication?: string[] | null
          competence_rs?: string[] | null
          competences_sauvetage?: string[] | null
          competences_securite?: string[] | null
          conditions_medicales?: string | null
          confidentialite?: boolean | null
          consent_photo?: boolean | null
          consent_photos?: boolean | null
          consentement_antecedents?: boolean | null
          contact_urgence_courriel?: string | null
          contact_urgence_lien?: string | null
          contact_urgence_nom?: string | null
          contact_urgence_telephone?: string | null
          created_at?: string
          date_expiration_certificat?: string | null
          date_naissance?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deleted_reason?: string | null
          disponible_covoiturage?: string[] | null
          email?: string
          equipe_canine?: string[] | null
          experience_urgence_detail?: string | null
          grandeur_bottes?: string | null
          groupe?: string
          groupe_recherche?: string | null
          groupe_sanguin?: string | null
          id?: number
          j_ai_18_ans?: boolean | null
          latitude?: number | null
          longitude?: number | null
          methode_connexion?: string
          monday_created_at?: string | null
          monday_group_id?: string | null
          navire_marin?: string[] | null
          niveau_ressource?: number
          nom?: string
          operation_urgence?: string[] | null
          permis_conduire?: string[] | null
          photo_url?: string | null
          preference_tache?: string | null
          preference_tache_commentaire?: string | null
          prenom?: string
          problemes_sante?: string | null
          profession?: string | null
          region?: string | null
          remboursement_bottes_date?: string | null
          responsable_groupe?: boolean
          role?: string
          satp_drone?: string[] | null
          statut?: string
          telephone?: string | null
          telephone_secondaire?: string | null
          updated_at?: string
          user_id?: string | null
          vehicule_tout_terrain?: string[] | null
          ville?: string | null
        }
        Relationships: []
      }
      reservistes_suppressions: {
        Row: {
          benevole_id: string
          demande_par_reserviste: boolean | null
          groupe_au_moment: string | null
          id: string
          nom: string
          prenom: string
          raison: string
          role: string | null
          supprime_le: string | null
          supprime_par_email: string | null
          supprime_par_user_id: string | null
        }
        Insert: {
          benevole_id: string
          demande_par_reserviste?: boolean | null
          groupe_au_moment?: string | null
          id?: string
          nom: string
          prenom: string
          raison: string
          role?: string | null
          supprime_le?: string | null
          supprime_par_email?: string | null
          supprime_par_user_id?: string | null
        }
        Update: {
          benevole_id?: string
          demande_par_reserviste?: boolean | null
          groupe_au_moment?: string | null
          id?: string
          nom?: string
          prenom?: string
          raison?: string
          role?: string | null
          supprime_le?: string | null
          supprime_par_email?: string | null
          supprime_par_user_id?: string | null
        }
        Relationships: []
      }
      retraits_temporaires: {
        Row: {
          action: string
          effectue_le: string
          effectue_par_email: string | null
          effectue_par_user_id: string | null
          entity_id: string
          entity_type: string
          groupe_au_moment: string | null
          id: string
          nom: string | null
          prenom: string | null
          raison: string
          retrait_parent_id: string | null
          role: string | null
        }
        Insert: {
          action: string
          effectue_le?: string
          effectue_par_email?: string | null
          effectue_par_user_id?: string | null
          entity_id: string
          entity_type: string
          groupe_au_moment?: string | null
          id?: string
          nom?: string | null
          prenom?: string | null
          raison: string
          retrait_parent_id?: string | null
          role?: string | null
        }
        Update: {
          action?: string
          effectue_le?: string
          effectue_par_email?: string | null
          effectue_par_user_id?: string | null
          entity_id?: string
          entity_type?: string
          groupe_au_moment?: string | null
          id?: string
          nom?: string | null
          prenom?: string | null
          raison?: string
          retrait_parent_id?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retraits_temporaires_retrait_parent_id_fkey"
            columns: ["retrait_parent_id"]
            isOneToOne: false
            referencedRelation: "retraits_temporaires"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistres: {
        Row: {
          created_at: string
          date_debut: string
          date_fin: string | null
          id: string
          lieu: string
          monday_id: string | null
          nom: string
          statut: string
          type_incident: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_debut: string
          date_fin?: string | null
          id?: string
          lieu: string
          monday_id?: string | null
          nom: string
          statut?: string
          type_incident: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_debut?: string
          date_fin?: string | null
          id?: string
          lieu?: string
          monday_id?: string | null
          nom?: string
          statut?: string
          type_incident?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_chats: {
        Row: {
          chat_id: string
          created_at: string | null
          event: string
          id: string
          message_count: number | null
          messages: Json | null
          raw_payload: Json | null
          visitor_city: string | null
          visitor_country: string | null
          visitor_email: string | null
          visitor_name: string | null
        }
        Insert: {
          chat_id: string
          created_at?: string | null
          event?: string
          id?: string
          message_count?: number | null
          messages?: Json | null
          raw_payload?: Json | null
          visitor_city?: string | null
          visitor_country?: string | null
          visitor_email?: string | null
          visitor_name?: string | null
        }
        Update: {
          chat_id?: string
          created_at?: string | null
          event?: string
          id?: string
          message_count?: number | null
          messages?: Json | null
          raw_payload?: Json | null
          visitor_city?: string | null
          visitor_country?: string | null
          visitor_email?: string | null
          visitor_name?: string | null
        }
        Relationships: []
      }
      templates_courriels: {
        Row: {
          body_html: string | null
          created_at: string
          id: string
          nom: string
          partage: boolean
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body_html?: string | null
          created_at?: string
          id?: string
          nom: string
          partage?: boolean
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body_html?: string | null
          created_at?: string
          id?: string
          nom?: string
          partage?: boolean
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vagues: {
        Row: {
          created_at: string
          date_debut: string
          date_fin: string
          deployment_id: string
          id: string
          identifiant: string | null
          monday_id: string | null
          nb_personnes_requis: number | null
          numero: number
          statut: string
        }
        Insert: {
          created_at?: string
          date_debut: string
          date_fin: string
          deployment_id: string
          id?: string
          identifiant?: string | null
          monday_id?: string | null
          nb_personnes_requis?: number | null
          numero: number
          statut?: string
        }
        Update: {
          created_at?: string
          date_debut?: string
          date_fin?: string
          deployment_id?: string
          id?: string
          identifiant?: string | null
          monday_id?: string | null
          nb_personnes_requis?: number | null
          numero?: number
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "vagues_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
        ]
      }
      vues_reservistes: {
        Row: {
          couleur: string | null
          created_at: string
          description: string | null
          filtres: Json
          id: string
          nom: string
          partage: boolean
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          couleur?: string | null
          created_at?: string
          description?: string | null
          filtres?: Json
          id?: string
          nom: string
          partage?: boolean
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          couleur?: string | null
          created_at?: string
          description?: string | null
          filtres?: Json
          id?: string
          nom?: string
          partage?: boolean
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      formations_benevoles_actives: {
        Row: {
          a_expiration: boolean | null
          benevole_id: string | null
          certificat_requis: boolean | null
          certificat_url: string | null
          certificat_url_archive: string | null
          commentaire: string | null
          competence_profil_champ: string | null
          competence_profil_label: string | null
          created_at: string | null
          date_expiration: string | null
          date_reussite: string | null
          deleted_at: string | null
          deleted_by_user_id: string | null
          deleted_reason: string | null
          etat_validite: string | null
          id: string | null
          initiation_sc_completee: boolean | null
          monday_item_id: number | null
          nom_complet: string | null
          nom_formation: string | null
          resultat: string | null
          role: string | null
          source: string | null
          unite: number | null
          updated_at: string | null
        }
        Insert: {
          a_expiration?: boolean | null
          benevole_id?: string | null
          certificat_requis?: boolean | null
          certificat_url?: string | null
          certificat_url_archive?: string | null
          commentaire?: string | null
          competence_profil_champ?: string | null
          competence_profil_label?: string | null
          created_at?: string | null
          date_expiration?: string | null
          date_reussite?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deleted_reason?: string | null
          etat_validite?: string | null
          id?: string | null
          initiation_sc_completee?: boolean | null
          monday_item_id?: number | null
          nom_complet?: string | null
          nom_formation?: string | null
          resultat?: string | null
          role?: string | null
          source?: string | null
          unite?: number | null
          updated_at?: string | null
        }
        Update: {
          a_expiration?: boolean | null
          benevole_id?: string | null
          certificat_requis?: boolean | null
          certificat_url?: string | null
          certificat_url_archive?: string | null
          commentaire?: string | null
          competence_profil_champ?: string | null
          competence_profil_label?: string | null
          created_at?: string | null
          date_expiration?: string | null
          date_reussite?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deleted_reason?: string | null
          etat_validite?: string | null
          id?: string | null
          initiation_sc_completee?: boolean | null
          monday_item_id?: number | null
          nom_complet?: string | null
          nom_formation?: string | null
          resultat?: string | null
          role?: string | null
          source?: string | null
          unite?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inscriptions_camps_partenaire: {
        Row: {
          benevole_id: string | null
          camp_dates: string | null
          camp_lieu: string | null
          camp_nom: string | null
          created_at: string | null
          id: string | null
          presence: Database["public"]["Enums"]["presence_status"] | null
          presence_updated_at: string | null
          session_id: string | null
        }
        Insert: {
          benevole_id?: string | null
          camp_dates?: string | null
          camp_lieu?: string | null
          camp_nom?: string | null
          created_at?: string | null
          id?: string | null
          presence?: Database["public"]["Enums"]["presence_status"] | null
          presence_updated_at?: string | null
          session_id?: string | null
        }
        Update: {
          benevole_id?: string | null
          camp_dates?: string | null
          camp_lieu?: string | null
          camp_nom?: string | null
          created_at?: string | null
          id?: string | null
          presence?: Database["public"]["Enums"]["presence_status"] | null
          presence_updated_at?: string | null
          session_id?: string | null
        }
        Relationships: []
      }
      reservistes_actifs: {
        Row: {
          adresse: string | null
          allergies_alimentaires: string | null
          allergies_autres: string | null
          antecedents_date_expiration: string | null
          antecedents_date_verification: string | null
          antecedents_statut: string | null
          autres_competences: string | null
          benevole_id: string | null
          camp_qualif_complete: boolean | null
          cartographie_sig: string[] | null
          certificat_premiers_soins: string[] | null
          certification_csi: string[] | null
          code_postal: string | null
          commentaire: string | null
          communication: string[] | null
          competence_rs: string[] | null
          competences_sauvetage: string[] | null
          competences_securite: string[] | null
          conditions_medicales: string | null
          confidentialite: boolean | null
          consent_photo: boolean | null
          consent_photos: boolean | null
          consentement_antecedents: boolean | null
          contact_urgence_courriel: string | null
          contact_urgence_lien: string | null
          contact_urgence_nom: string | null
          contact_urgence_telephone: string | null
          created_at: string | null
          date_expiration_certificat: string | null
          date_naissance: string | null
          deleted_at: string | null
          deleted_by_user_id: string | null
          deleted_reason: string | null
          disponible_covoiturage: string[] | null
          email: string | null
          equipe_canine: string[] | null
          experience_urgence_detail: string | null
          grandeur_bottes: string | null
          groupe: string | null
          groupe_recherche: string | null
          groupe_sanguin: string | null
          id: number | null
          j_ai_18_ans: boolean | null
          latitude: number | null
          longitude: number | null
          methode_connexion: string | null
          monday_created_at: string | null
          monday_group_id: string | null
          navire_marin: string[] | null
          niveau_ressource: number | null
          nom: string | null
          operation_urgence: string[] | null
          permis_conduire: string[] | null
          photo_url: string | null
          preference_tache: string | null
          preference_tache_commentaire: string | null
          prenom: string | null
          problemes_sante: string | null
          profession: string | null
          region: string | null
          remboursement_bottes_date: string | null
          responsable_groupe: boolean | null
          role: string | null
          satp_drone: string[] | null
          statut: string | null
          telephone: string | null
          telephone_secondaire: string | null
          updated_at: string | null
          user_id: string | null
          vehicule_tout_terrain: string[] | null
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          allergies_alimentaires?: string | null
          allergies_autres?: string | null
          antecedents_date_expiration?: string | null
          antecedents_date_verification?: string | null
          antecedents_statut?: string | null
          autres_competences?: string | null
          benevole_id?: string | null
          camp_qualif_complete?: boolean | null
          cartographie_sig?: string[] | null
          certificat_premiers_soins?: string[] | null
          certification_csi?: string[] | null
          code_postal?: string | null
          commentaire?: string | null
          communication?: string[] | null
          competence_rs?: string[] | null
          competences_sauvetage?: string[] | null
          competences_securite?: string[] | null
          conditions_medicales?: string | null
          confidentialite?: boolean | null
          consent_photo?: boolean | null
          consent_photos?: boolean | null
          consentement_antecedents?: boolean | null
          contact_urgence_courriel?: string | null
          contact_urgence_lien?: string | null
          contact_urgence_nom?: string | null
          contact_urgence_telephone?: string | null
          created_at?: string | null
          date_expiration_certificat?: string | null
          date_naissance?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deleted_reason?: string | null
          disponible_covoiturage?: string[] | null
          email?: string | null
          equipe_canine?: string[] | null
          experience_urgence_detail?: string | null
          grandeur_bottes?: string | null
          groupe?: string | null
          groupe_recherche?: string | null
          groupe_sanguin?: string | null
          id?: number | null
          j_ai_18_ans?: boolean | null
          latitude?: number | null
          longitude?: number | null
          methode_connexion?: string | null
          monday_created_at?: string | null
          monday_group_id?: string | null
          navire_marin?: string[] | null
          niveau_ressource?: number | null
          nom?: string | null
          operation_urgence?: string[] | null
          permis_conduire?: string[] | null
          photo_url?: string | null
          preference_tache?: string | null
          preference_tache_commentaire?: string | null
          prenom?: string | null
          problemes_sante?: string | null
          profession?: string | null
          region?: string | null
          remboursement_bottes_date?: string | null
          responsable_groupe?: boolean | null
          role?: string | null
          satp_drone?: string[] | null
          statut?: string | null
          telephone?: string | null
          telephone_secondaire?: string | null
          updated_at?: string | null
          user_id?: string | null
          vehicule_tout_terrain?: string[] | null
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          allergies_alimentaires?: string | null
          allergies_autres?: string | null
          antecedents_date_expiration?: string | null
          antecedents_date_verification?: string | null
          antecedents_statut?: string | null
          autres_competences?: string | null
          benevole_id?: string | null
          camp_qualif_complete?: boolean | null
          cartographie_sig?: string[] | null
          certificat_premiers_soins?: string[] | null
          certification_csi?: string[] | null
          code_postal?: string | null
          commentaire?: string | null
          communication?: string[] | null
          competence_rs?: string[] | null
          competences_sauvetage?: string[] | null
          competences_securite?: string[] | null
          conditions_medicales?: string | null
          confidentialite?: boolean | null
          consent_photo?: boolean | null
          consent_photos?: boolean | null
          consentement_antecedents?: boolean | null
          contact_urgence_courriel?: string | null
          contact_urgence_lien?: string | null
          contact_urgence_nom?: string | null
          contact_urgence_telephone?: string | null
          created_at?: string | null
          date_expiration_certificat?: string | null
          date_naissance?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deleted_reason?: string | null
          disponible_covoiturage?: string[] | null
          email?: string | null
          equipe_canine?: string[] | null
          experience_urgence_detail?: string | null
          grandeur_bottes?: string | null
          groupe?: string | null
          groupe_recherche?: string | null
          groupe_sanguin?: string | null
          id?: number | null
          j_ai_18_ans?: boolean | null
          latitude?: number | null
          longitude?: number | null
          methode_connexion?: string | null
          monday_created_at?: string | null
          monday_group_id?: string | null
          navire_marin?: string[] | null
          niveau_ressource?: number | null
          nom?: string | null
          operation_urgence?: string[] | null
          permis_conduire?: string[] | null
          photo_url?: string | null
          preference_tache?: string | null
          preference_tache_commentaire?: string | null
          prenom?: string | null
          problemes_sante?: string | null
          profession?: string | null
          region?: string | null
          remboursement_bottes_date?: string | null
          responsable_groupe?: boolean | null
          role?: string | null
          satp_drone?: string[] | null
          statut?: string | null
          telephone?: string | null
          telephone_secondaire?: string | null
          updated_at?: string | null
          user_id?: string | null
          vehicule_tout_terrain?: string[] | null
          ville?: string | null
        }
        Relationships: []
      }
      v_dossier_reserviste: {
        Row: {
          adresse_code_postal: string | null
          adresse_province: string | null
          adresse_rue: string | null
          adresse_ville: string | null
          allergies_alimentaires: string[] | null
          allergies_autres: string | null
          autres_competences: string | null
          benevole_id: string | null
          certificat_premiers_soins: string[] | null
          certification_csi: string[] | null
          commentaire: string | null
          communication: string[] | null
          competence_rs: string[] | null
          competences_securite: string[] | null
          confidentialite: string | null
          created_at: string | null
          disponibilite_generale: string | null
          disponibilite_urgence: boolean | null
          email: string | null
          equipe_canine: string[] | null
          groupe: string | null
          groupe_sanguin: string | null
          id: string | null
          navire_marin: string[] | null
          nom: string | null
          permis_conduire: string[] | null
          prenom: string | null
          problemes_sante: string | null
          satp_drone: string[] | null
          statut: string | null
          synced_from_monday_at: string | null
          synced_to_monday_at: string | null
          telephone: string | null
          updated_at: string | null
          user_id: string | null
          vehicule_tout_terrain: string[] | null
        }
        Relationships: []
      }
      v_inscriptions_portail: {
        Row: {
          benevole_id: string | null
          camp_adresse: string | null
          camp_dates: string | null
          camp_lieu: string | null
          camp_nom: string | null
          created_at: string | null
          id: string | null
          is_synced: boolean | null
          presence: Database["public"]["Enums"]["presence_status"] | null
          session_id: string | null
        }
        Insert: {
          benevole_id?: string | null
          camp_adresse?: string | null
          camp_dates?: string | null
          camp_lieu?: string | null
          camp_nom?: string | null
          created_at?: string | null
          id?: string | null
          is_synced?: never
          presence?: Database["public"]["Enums"]["presence_status"] | null
          session_id?: string | null
        }
        Update: {
          benevole_id?: string | null
          camp_adresse?: string | null
          camp_dates?: string | null
          camp_lieu?: string | null
          camp_nom?: string | null
          created_at?: string | null
          id?: string | null
          is_synced?: never
          presence?: Database["public"]["Enums"]["presence_status"] | null
          session_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      audit_attach_table: {
        Args: { p_pk_col?: string; p_table: string }
        Returns: undefined
      }
      audit_detach_table: { Args: { p_table: string }; Returns: undefined }
      audit_purge_old: { Args: { p_months?: number }; Returns: number }
      audit_set_acting_user: {
        Args: { p_email: string; p_user_id: string }
        Returns: undefined
      }
      check_reserviste_login: {
        Args: { lookup_email: string }
        Returns: {
          benevole_id: string
          email: string
          groupe: string
          methode_connexion: string
          nom: string
          prenom: string
          telephone: string
        }[]
      }
      cleanup_phantom_users: { Args: never; Returns: Json }
      desactiver_certificat_competence: {
        Args: {
          p_benevole_id: string
          p_competence_champ: string
          p_competence_label: string
        }
        Returns: Json
      }
      fix_user_id_mismatches: {
        Args: never
        Returns: {
          fixed_email: string
          new_uid: string
          old_uid: string
        }[]
      }
      formations_hard_delete: {
        Args: { p_formation_id: number }
        Returns: number
      }
      formations_restore: {
        Args: {
          p_caller_email?: string
          p_caller_user_id?: string
          p_formation_id: number
        }
        Returns: boolean
      }
      formations_soft_delete: {
        Args: {
          p_caller_email?: string
          p_caller_user_id?: string
          p_formation_id: number
          p_reason: string
        }
        Returns: boolean
      }
      get_campagne_courriel_stats: {
        Args: never
        Returns: {
          bounced: number
          campagne_id: string
          clicked: number
          complained: number
          delivered: number
          failed: number
          opened: number
          queued: number
          sent: number
          total: number
        }[]
      }
      get_campagne_reponse_stats: {
        Args: never
        Returns: {
          campagne_id: string
          non_lues: number
          total: number
        }[]
      }
      get_certificats_competence: {
        Args: { p_benevole_id: string }
        Returns: {
          a_expiration: boolean
          certificat_url: string
          competence_profil_champ: string
          competence_profil_label: string
          date_expiration: string
          date_reussite: string
          etat_validite: string
          id: string
          monday_item_id: number
          nom_formation: string
          resultat: string
        }[]
      }
      get_ciblages_by_benevole_id: {
        Args: { target_benevole_id: string }
        Returns: {
          deploiement_id: string
        }[]
      }
      get_deployabilite: {
        Args: {
          p_benevole_id: string
          p_date_debut?: string
          p_date_fin?: string
        }
        Returns: Json
      }
      get_documents_by_benevole_id: {
        Args: { target_benevole_id: string }
        Returns: {
          benevole_id: string
          chemin_storage: string
          created_at: string | null
          date_creation: string | null
          id: number
          nom_fichier: string
          titre: string
          type_document: string
          url_public: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "documents_officiels"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_formations_by_benevole_id: {
        Args: { target_benevole_id: string }
        Returns: {
          a_expiration: boolean | null
          benevole_id: string | null
          certificat_requis: boolean | null
          certificat_url: string | null
          certificat_url_archive: string | null
          commentaire: string | null
          competence_profil_champ: string | null
          competence_profil_label: string | null
          created_at: string | null
          date_expiration: string | null
          date_reussite: string | null
          deleted_at: string | null
          deleted_by_user_id: string | null
          deleted_reason: string | null
          etat_validite: string | null
          id: string
          initiation_sc_completee: boolean | null
          monday_item_id: number | null
          nom_complet: string | null
          nom_formation: string | null
          resultat: string | null
          role: string | null
          source: string | null
          unite: number | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "formations_benevoles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_inscriptions_by_benevole_id: {
        Args: { target_benevole_id: string }
        Returns: {
          benevole_id: string
          cahier_envoye: boolean | null
          camp_adresse: string | null
          camp_dates: string | null
          camp_lieu: string | null
          camp_nom: string | null
          courriel: string | null
          created_at: string | null
          id: string
          monday_item_id: string | null
          notification_sent_at: string | null
          notification_type: string | null
          prenom_nom: string
          presence: Database["public"]["Enums"]["presence_status"]
          presence_updated_at: string | null
          session_id: string
          sync_error: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          telephone: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "inscriptions_camps"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_my_dossier: {
        Args: never
        Returns: {
          adresse_code_postal: string | null
          adresse_province: string | null
          adresse_rue: string | null
          adresse_ville: string | null
          allergies_alimentaires: string[] | null
          allergies_autres: string | null
          autres_competences: string | null
          benevole_id: string
          certificat_premiers_soins: string[] | null
          certification_csi: string[] | null
          commentaire: string | null
          communication: string[] | null
          competence_rs: string[] | null
          competences_securite: string[] | null
          confidentialite: string | null
          created_at: string | null
          disponibilite_generale: string | null
          disponibilite_urgence: boolean | null
          email: string | null
          equipe_canine: string[] | null
          groupe_sanguin: string | null
          id: string
          navire_marin: string[] | null
          nom: string | null
          permis_conduire: string[] | null
          prenom: string | null
          problemes_sante: string | null
          satp_drone: string[] | null
          synced_from_monday_at: string | null
          synced_to_monday_at: string | null
          telephone: string | null
          updated_at: string | null
          user_id: string | null
          vehicule_tout_terrain: string[] | null
        }[]
        SetofOptions: {
          from: "*"
          to: "dossier_reserviste"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_nextval: { Args: { seq_name: string }; Returns: number }
      get_pool_ciblage: {
        Args: {
          p_date_debut: string
          p_date_fin?: string
          p_niveau: string
          p_preference?: string
          p_reference_id: string
          p_regions?: string[]
        }
        Returns: {
          benevole_id: string
          deja_cible: boolean
          deployable: boolean
          en_deploiement_actif: boolean
          nom: string
          preference_tache: string
          preference_tache_commentaire: string
          prenom: string
          raison_alerte: string
          region: string
          repos_requis_jusqu: string
          rotations_consecutives: number
          telephone: string
          ville: string
        }[]
      }
      get_reserviste_by_benevole_id: {
        Args: { target_benevole_id: string }
        Returns: {
          adresse: string
          allergies_alimentaires: string
          allergies_autres: string
          antecedents_date_expiration: string
          antecedents_date_verification: string
          antecedents_statut: string
          benevole_id: string
          conditions_medicales: string
          consent_photo: boolean
          contact_urgence_nom: string
          contact_urgence_telephone: string
          date_naissance: string
          email: string
          groupe: string
          monday_created_at: string
          nom: string
          photo_url: string
          prenom: string
          region: string
          role: string
          telephone: string
          user_id: string
          ville: string
        }[]
      }
      get_reserviste_for_impersonate: {
        Args: { admin_benevole_id: string; target_benevole_id: string }
        Returns: {
          benevole_id: string
          email: string
          nom: string
          prenom: string
          role: string
        }[]
      }
      get_reserviste_role:
        | {
            Args: never
            Returns: {
              benevole_id: string
              role: string
            }[]
          }
        | { Args: { target_benevole_id: string }; Returns: string }
      get_user_id_by_email: {
        Args: { email_input: string }
        Returns: {
          user_id: string
        }[]
      }
      hook_log_connexion: { Args: { event: Json }; Returns: undefined }
      insert_formation_sinitier: {
        Args: {
          p_benevole_id: string
          p_certificat_url?: string
          p_date_reussite?: string
          p_nom_complet: string
        }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_admin_or_coord: { Args: never; Returns: boolean }
      is_partenaire: { Args: never; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
      merge_phone_login: {
        Args: { login_email: string; phone_auth_uid: string }
        Returns: Json
      }
      my_benevole_id: { Args: never; Returns: string }
      prepare_phone_login: {
        Args: { login_email: string; phone_number: string }
        Returns: Json
      }
      reservistes_hard_delete: {
        Args: { p_benevole_id: string }
        Returns: number
      }
      reservistes_restore: {
        Args: {
          p_benevole_id: string
          p_caller_email?: string
          p_caller_user_id?: string
        }
        Returns: boolean
      }
      search_reservistes_admin: {
        Args: { search_term: string }
        Returns: {
          benevole_id: string
          email: string
          groupe: string
          nom: string
          prenom: string
        }[]
      }
      set_monday_item_id: {
        Args: { p_formation_id: string; p_monday_item_id: number }
        Returns: undefined
      }
      sync_user_id_on_login: {
        Args: { auth_uid: string; login_email: string }
        Returns: undefined
      }
      upsert_certificat_competence: {
        Args: {
          p_a_expiration?: boolean
          p_benevole_id: string
          p_competence_champ: string
          p_competence_label: string
          p_nom_formation: string
        }
        Returns: Json
      }
      upsert_dossier: {
        Args: { p_benevole_id: string; p_data: Json }
        Returns: {
          adresse_code_postal: string | null
          adresse_province: string | null
          adresse_rue: string | null
          adresse_ville: string | null
          allergies_alimentaires: string[] | null
          allergies_autres: string | null
          autres_competences: string | null
          benevole_id: string
          certificat_premiers_soins: string[] | null
          certification_csi: string[] | null
          commentaire: string | null
          communication: string[] | null
          competence_rs: string[] | null
          competences_securite: string[] | null
          confidentialite: string | null
          created_at: string | null
          disponibilite_generale: string | null
          disponibilite_urgence: boolean | null
          email: string | null
          equipe_canine: string[] | null
          groupe_sanguin: string | null
          id: string
          navire_marin: string[] | null
          nom: string | null
          permis_conduire: string[] | null
          prenom: string | null
          problemes_sante: string | null
          satp_drone: string[] | null
          synced_from_monday_at: string | null
          synced_to_monday_at: string | null
          telephone: string | null
          updated_at: string | null
          user_id: string | null
          vehicule_tout_terrain: string[] | null
        }
        SetofOptions: {
          from: "*"
          to: "dossier_reserviste"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      presence_status: "confirme" | "absent" | "incertain" | "annule"
      sync_status: "pending" | "synced" | "error"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      presence_status: ["confirme", "absent", "incertain", "annule"],
      sync_status: ["pending", "synced", "error"],
    },
  },
} as const
