"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  ChangeEvent,
  useCallback,
} from "react";
import type {
  Property,
  PropertyFollowUp,
  PropertySmsMessage,
  SavedSearch,
} from "@/lib/types";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";
import { SmsAutomationSection } from "@/components/properties/SmsAutomationSection";
import type {
  Sequence,
  SequenceEnrollment,
} from "@/types/sequences";

export default function HomePage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [minPrice, setMinPrice] = useState<number | "">("");
  const [maxPrice, setMaxPrice] = useState<number | "">("");
  const [maxDom, setMaxDom] = useState<number | "">("");
  const [minMotivation, setMinMotivation] = useState<number | "">("");
  const [status, setStatus] = useState<"All" | Property["status"]>("All");
  const [leadStageFilter, setLeadStageFilter] = useState<
    "All" | "new" | "contacted" | "follow_up" | "dead"
  >("All");

  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    null
  );

  // 🔹 Seller phone editing state (Step 5)
  const [sellerPhone, setSellerPhone] = useState<string>("");
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // 🔹 Text seller state (Step 6)
  const [isTextingSeller, setIsTextingSeller] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"signIn" | "signUp">("signIn");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);

  // Notes (per property, per user)
  const [noteText, setNoteText] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [smsMessages, setSmsMessages] = useState<PropertySmsMessage[]>([]);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [smsSequences, setSmsSequences] = useState<Sequence[]>([]);
  const [smsEnrollment, setSmsEnrollment] =
    useState<SequenceEnrollment | null>(null);
  const [smsAutomationLoading, setSmsAutomationLoading] = useState(false);
  const [smsAutomationError, setSmsAutomationError] = useState<string | null>(
    null
  );
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [isLoadingSavedSearches, setIsLoadingSavedSearches] = useState(false);
  const [savedSearchError, setSavedSearchError] = useState<string | null>(null);
  const [newSearchName, setNewSearchName] = useState("");

  // Global upcoming follow-ups list (for current user)
  const [followups, setFollowups] = useState<PropertyFollowUp[]>([]);
  const [followupsLoading, setFollowupsLoading] = useState(false);
  const [followupsError, setFollowupsError] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ type, message });
    toastTimerRef.current = setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Fetch properties from API
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const res = await fetch("/api/properties");
        const data: Property[] | { error: string } = await res.json();
        if (!res.ok) {
          const message =
            (data as any)?.error || "Failed to fetch properties";
          throw new Error(message);
        }
        if (!Array.isArray(data)) {
          throw new Error("Unexpected response when loading properties.");
        }
        setProperties(data);
      } catch (err) {
        console.error(err);
        setError("Could not load properties.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProperties();
  }, []);

  // Check existing auth session on mount
  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) {
        setUser(data.user);
      }
    };
    loadUser();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAuthInfo(null);
    setAuthError(null);
    setFollowups([]);
    closeDetail();
  };

  const refreshFollowups = async (currentUser: User | null = user) => {
    if (!currentUser) {
      setFollowups([]);
      return;
    }

    try {
      setFollowupsError(null);
      setFollowupsLoading(true);

      const { data, error } = await supabase
        .from("property_followups")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("due_at", { ascending: true })
        .limit(10);

      if (error) {
        console.error(error);
        setFollowupsError("Could not load follow-ups.");
        return;
      }

      const mapped: PropertyFollowUp[] = (data ?? []).map((f: any) => ({
        id: f.id,
        propertyId: f.property_id,
        userId: f.user_id,
        title: f.title,
        dueAt: f.due_at,
        createdAt: f.created_at,
        completedAt: f.completed_at,
        status: (f.status as PropertyFollowUp["status"]) ?? "pending",
      }));

      setFollowups(mapped);
    } catch (err) {
      console.error(err);
      setFollowupsError("Could not load follow-ups.");
    } finally {
      setFollowupsLoading(false);
    }
  };

  // Load follow-ups whenever user changes
  useEffect(() => {
    if (user) {
      refreshFollowups(user);
    } else {
      setFollowups([]);
    }
  }, [user]);

  useEffect(() => {
    const loadSavedSearches = async () => {
      if (!user) {
        setSavedSearches([]);
        return;
      }

      setIsLoadingSavedSearches(true);
      setSavedSearchError(null);

      try {
        const res = await fetch(`/api/saved-searches?userId=${user.id}`);
        const payload = await res.json();

        if (!res.ok) {
          setSavedSearchError(
            (payload as any)?.error || "Could not load saved searches."
          );
          return;
        }

        setSavedSearches((payload as any).savedSearches ?? []);
      } catch (err) {
        setSavedSearchError("Could not load saved searches.");
      } finally {
        setIsLoadingSavedSearches(false);
      }
    };

    loadSavedSearches();
  }, [user]);

  const getCurrentFilters = () => ({
    search,
    minPrice,
    maxPrice,
    maxDom,
    minMotivation,
    status,
    leadStageFilter,
  });

  const applyFilters = (filters: any) => {
    if (!filters) return;
    setSearch(filters.search ?? "");
    setMinPrice(filters.minPrice ?? "");
    setMaxPrice(filters.maxPrice ?? "");
    setMaxDom(filters.maxDom ?? "");
    setMinMotivation(filters.minMotivation ?? "");
    setStatus(filters.status ?? "All");
    setLeadStageFilter(filters.leadStageFilter ?? "All");
  };

  const handleSignIn = async () => {
    try {
      setAuthLoading(true);
      setAuthError(null);
      setAuthInfo(null);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });

      if (error) {
        console.error(error);
        setAuthError(error.message || "Could not sign in.");
        return;
      }

      if (data.user) {
        setUser(data.user);
        setAuthInfo("Signed in.");
        setAuthPassword("");
        await refreshFollowups(data.user);
      }
    } catch (err) {
      console.error(err);
      setAuthError("Could not sign in.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignUp = async () => {
    try {
      setAuthLoading(true);
      setAuthError(null);
      setAuthInfo(null);

      const { data, error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
      });

      if (error) {
        console.error(error);
        setAuthError(error.message || "Could not sign up.");
        return;
      }

      if (data.user) {
        setUser(data.user);
        setAuthInfo("Account created and signed in.");
        setAuthPassword("");
        await refreshFollowups(data.user);
      } else {
        setAuthInfo("Check your email to confirm your account.");
      }
    } catch (err) {
      console.error(err);
      setAuthError("Could not sign up.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!authEmail) {
      setAuthError("Enter your email to receive a reset link.");
      return;
    }

    try {
      setAuthLoading(true);
      setAuthError(null);
      setAuthInfo(null);

      const redirectTo =
        typeof window !== "undefined" ? window.location.origin : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(authEmail, {
        redirectTo,
      });

      if (error) {
        console.error(error);
        setAuthError(error.message || "Could not send reset email.");
        return;
      }

      setAuthInfo(
        "If an account exists for that email, a reset link has been sent."
      );
    } catch (err) {
      console.error(err);
      setAuthError("Could not send reset email.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAddFollowup = async () => {
    if (!selectedProperty || !user) return;

    try {
      const title = `Follow up with seller for ${selectedProperty.address}`;
      const due = new Date();
      due.setDate(due.getDate() + 2);

      const res = await fetch("/api/followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: selectedProperty.id,
          userId: user.id,
          title,
          dueAt: due.toISOString(),
        }),
      });

      const payload = await res.json();

      if (!res.ok) {
        showToast("error", (payload as any)?.error || "Failed to add follow-up.");
        return;
      }

      const newFollowup = (payload as any).followup;

      setFollowups((prev) => [newFollowup, ...prev]);
      showToast("success", "Follow-up added.");
    } catch (err) {
      showToast("error", "Unexpected error adding follow-up.");
    }
  };

  const handleCompleteFollowup = async (followupId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("property_followups")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", followupId)
        .eq("user_id", user.id);

      if (error) {
        console.error(error);
        showToast("error", "Could not update follow-up.");
        return;
      }

      setFollowups((prev) =>
        prev.map((f) =>
          f.id === followupId
            ? { ...f, status: "completed", completedAt: new Date().toISOString() }
            : f
        )
      );
    } catch (err) {
      console.error(err);
      showToast("error", "Could not update follow-up.");
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedProperty || !user) return;

    try {
      setIsSavingNote(true);
      setNoteError(null);
      setFeedbackMessage(null);

      const { data: existing, error: fetchError } = await supabase
        .from("property_notes")
        .select("id")
        .eq("property_id", selectedProperty.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchError) {
        setNoteError("Could not load existing notes.");
        return;
      }

      let saveError = null;

      if (existing) {
        const { error } = await supabase
          .from("property_notes")
          .update({
            notes: noteText,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        saveError = error;
      } else {
        const { error } = await supabase.from("property_notes").insert({
          property_id: selectedProperty.id,
          user_id: user.id,
          notes: noteText,
        });
        saveError = error;
      }

      if (saveError) {
        setNoteError("Could not save notes.");
        return;
      }

      setFeedbackMessage("Notes saved.");
      setTimeout(() => setFeedbackMessage(null), 2000);
    } catch (err) {
      setNoteError("Could not save notes.");
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleSaveCurrentSearch = async () => {
    if (!user) {
      showToast("error", "Sign in to save searches.");
      return;
    }
    const name = newSearchName.trim();
    if (!name) {
      showToast("error", "Give this search a name.");
      return;
    }

    try {
      const filters = getCurrentFilters();
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          name,
          filters,
        }),
      });

      const payload = await res.json();

      if (!res.ok) {
        showToast(
          "error",
          (payload as any)?.error || "Could not save search."
        );
        return;
      }

      const created = (payload as any).savedSearch as SavedSearch;
      setSavedSearches((prev) => [created, ...prev]);
      setNewSearchName("");
      showToast("success", "Search saved.");
    } catch (err) {
      showToast("error", "Could not save search.");
    }
  };

  const handleApplySavedSearch = (saved: SavedSearch) => {
    applyFilters(saved.filters);
    showToast("success", `Applied "${saved.name}".`);
  };

  const handleDeleteSavedSearch = async (id: string) => {
    if (!user) return;

    try {
      const res = await fetch("/api/saved-searches", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, userId: user.id }),
      });

      const payload = await res.json();

      if (!res.ok) {
        showToast(
          "error",
          (payload as any)?.error || "Could not delete search."
        );
        return;
      }

      setSavedSearches((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      showToast("error", "Could not delete search.");
    }
  };

  const loadSmsHistory = useCallback(async () => {
    if (!selectedProperty || !user) {
      setSmsMessages([]);
      setSmsError(null);
      return;
    }

    try {
      setSmsLoading(true);
      setSmsError(null);

      const { data, error } = await supabase
        .from("property_sms_messages")
        .select(
          "id, property_id, user_id, to_number, from_number, body, status, provider_message_sid, error_message, created_at, source"
        )
        .eq("property_id", selectedProperty.id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        setSmsError("Could not load SMS history.");
        return;
      }

      const mapped: PropertySmsMessage[] = (data ?? []).map((row: any) => ({
        id: row.id,
        propertyId: row.property_id,
        userId: row.user_id,
        toNumber: row.to_number,
        fromNumber: row.from_number,
        body: row.body,
        status: (row.status as "sent" | "failed") ?? "sent",
        providerMessageSid: row.provider_message_sid,
        errorMessage: row.error_message,
        createdAt: row.created_at,
        source: row.source,
      }));

      setSmsMessages(mapped);
    } catch (err) {
      setSmsError("Could not load SMS history.");
    } finally {
      setSmsLoading(false);
    }
  }, [selectedProperty, user]);

  const loadSmsAutomation = useCallback(async () => {
    if (!selectedProperty || !user) {
      setSmsSequences([]);
      setSmsEnrollment(null);
      setSmsAutomationError(null);
      return;
    }

    try {
      setSmsAutomationLoading(true);
      setSmsAutomationError(null);

      const { data: seqs, error: seqsError } = await supabase
        .from("sms_sequences")
        .select("id, user_id, name, is_active, created_at")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (seqsError) {
        setSmsAutomationError("Could not load SMS automation data.");
        return;
      }

      setSmsSequences(
        (seqs ?? []).map((s: any) => ({
          id: s.id,
          user_id: s.user_id ?? null,
          name: s.name,
          is_active: s.is_active,
          created_at: s.created_at ?? "",
          updated_at: s.updated_at ?? null,
        }))
      );

      const { data: enrollment, error: enrollmentError } = await supabase
        .from("sms_sequence_enrollments")
        .select(
          "id, sequence_id, user_id, property_id, current_step, next_run_at, is_paused, completed_at, last_error, last_error_code, last_error_at, created_at, sequence:sms_sequences(name)"
        )
        .eq("property_id", selectedProperty.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (enrollmentError) {
        setSmsAutomationError("Could not load SMS automation data.");
        return;
      }

      if (enrollment) {
        setSmsEnrollment({
          id: enrollment.id,
          sequence_id: enrollment.sequence_id,
          user_id: enrollment.user_id,
          property_id: enrollment.property_id,
          current_step: enrollment.current_step,
          next_run_at: enrollment.next_run_at,
          is_paused: enrollment.is_paused,
          completed_at: enrollment.completed_at,
          last_error: enrollment.last_error,
          last_error_code: enrollment.last_error_code ?? null,
          last_error_at: enrollment.last_error_at ?? null,
          created_at: enrollment.created_at,
          sequence: enrollment.sequence
            ? { name: (enrollment as any).sequence.name }
            : null,
        });
      } else {
        setSmsEnrollment(null);
      }
    } catch (err) {
      setSmsAutomationError("Could not load SMS automation data.");
    } finally {
      setSmsAutomationLoading(false);
    }
  }, [selectedProperty, user]);

  useEffect(() => {
    if (!selectedProperty || !user) {
      setSmsMessages([]);
      setSmsSequences([]);
      setSmsEnrollment(null);
      setSmsError(null);
      setSmsAutomationError(null);
      return;
    }

    loadSmsHistory();
    loadSmsAutomation();
  }, [selectedProperty, user, loadSmsHistory, loadSmsAutomation]);

  // Load notes for selected property (scoped to user)
  useEffect(() => {
    // Clear notes when switching properties or logging out
    if (!selectedProperty || !user) {
      setNoteText("");
      setNoteError(null);
      setFeedbackMessage(null);
      return;
    }

    const loadNotes = async () => {
      try {
        setNoteError(null);
        setFeedbackMessage(null);

        const { data, error } = await supabase
          .from("property_notes")
          .select("id, notes")
          .eq("property_id", selectedProperty.id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error(error);
          setNoteError("Could not load notes.");
          return;
        }

        setNoteText(data?.notes ?? "");
      } catch (err) {
        console.error(err);
        setNoteError("Could not load notes.");
      }
    };

    loadNotes();
  }, [selectedProperty, user]);

  const filteredProperties = useMemo(() => {
    return properties
      .filter((p) => {
        const term = search.toLowerCase().trim();
        if (term) {
          const blob = `${p.address} ${p.city} ${p.state} ${p.zip}`.toLowerCase();
          if (!blob.includes(term)) return false;
        }

        if (typeof minPrice === "number" && p.listPrice < minPrice) return false;
        if (typeof maxPrice === "number" && p.listPrice > maxPrice) return false;
        const domValue =
          p.dom !== null && p.dom !== undefined ? p.dom : Number.MAX_SAFE_INTEGER;
        if (typeof maxDom === "number" && domValue > maxDom) return false;
        if (
          typeof minMotivation === "number" &&
          p.motivationScore < minMotivation
        )
          return false;

        if (status !== "All" && p.status !== status) return false;

        if (leadStageFilter !== "All") {
          const stage = p.leadStage ?? "new";
          if (stage !== leadStageFilter) return false;
        }

        return true;
      })
      .sort((a, b) => b.motivationScore - a.motivationScore);
  }, [
    properties,
    search,
    minPrice,
    maxPrice,
    maxDom,
    minMotivation,
    status,
    leadStageFilter,
  ]);

  const kpiStats = useMemo(() => {
    const counts = {
      total: filteredProperties.length,
      new: 0,
      contacted: 0,
      follow_up: 0,
      dead: 0,
      avgMotivation: 0,
      avgSpread: 0,
      motivationCount: 0,
      spreadCount: 0,
    };

    let motivationTotal = 0;
    let motivationCount = 0;
    let spreadTotal = 0;
    let spreadCount = 0;

    filteredProperties.forEach((p) => {
      const stage = (p.leadStage ?? "new") as keyof typeof counts;
      if (stage in counts) {
        counts[stage as "new" | "contacted" | "follow_up" | "dead"] += 1;
      }

      if (typeof p.motivationScore === "number") {
        motivationTotal += p.motivationScore;
        motivationCount += 1;
        counts.motivationCount += 1;
      }

      if (p.arv !== null && p.arv !== undefined) {
        spreadTotal += p.arv - p.listPrice;
        spreadCount += 1;
        counts.spreadCount += 1;
      }
    });

    counts.avgMotivation =
      motivationCount > 0 ? motivationTotal / motivationCount : 0;
    counts.avgSpread = spreadCount > 0 ? spreadTotal / spreadCount : 0;

    return counts;
  }, [filteredProperties]);

  const updateLeadStage = async (
    propertyId: string,
    leadStage: "new" | "contacted" | "follow_up" | "dead"
  ) => {
    try {
      const res = await fetch("/api/properties/lead-stage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, leadStage }),
      });

      const payload = await res.json();

      if (!res.ok) {
        console.error(payload);
        showToast(
          "error",
          (payload as any)?.error || "Could not update lead stage."
        );
        return;
      }

      showToast("success", "Lead stage updated.");

      // Update local state
      setProperties((prev) =>
        prev.map((p) =>
          p.id === propertyId ? { ...p, leadStage } : p
        )
      );

      setSelectedProperty((prev) =>
        prev && prev.id === propertyId ? { ...prev, leadStage } : prev
      );
    } catch (err) {
      console.error(err);
      showToast("error", "Could not update lead stage.");
    }
  };

  const handleNumberChange =
    (setter: (v: number | "") => void) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (val === "") {
        setter("");
      } else {
        const n = Number(val.replace(/[^0-9]/g, ""));
        if (!Number.isNaN(n)) setter(n);
      }
    };

  const formatMoney = (n: number) =>
    `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const formatMoneyOptional = (n: number | null | undefined) =>
    n === null || n === undefined ? "—" : formatMoney(n);
  const formatNumber = (
    n: number | null | undefined,
    maximumFractionDigits = 0
  ) =>
    n === null || n === undefined
      ? "—"
      : n.toLocaleString(undefined, { maximumFractionDigits });

  // Helper: normalize phone (Step 5)
  const normalizePhone = (input: string) => input.trim();

  const closeDetail = () => {
    setSelectedProperty(null);
    setNoteText("");
    setNoteError(null);
    setFeedbackMessage(null);
    setSellerPhone("");
    setPhoneError(null);
    setTextError(null);
  };

  // When opening a property detail, sync sellerPhone state
  const openDetail = (property: Property) => {
    setSelectedProperty(property);
    setSellerPhone(property.sellerPhone ?? "");
    setPhoneError(null);
    setTextError(null);
  };

  // 🔹 Step 5: Save seller phone via API and sync state
  const handleSaveSellerPhone = async () => {
    if (!selectedProperty) return;

    setIsSavingPhone(true);
    setPhoneError(null);

    try {
      const normalized = normalizePhone(sellerPhone);

      const res = await fetch("/api/properties/seller-phone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: selectedProperty.id,
          sellerPhone: normalized || null,
        }),
      });

      const payload = await res.json();

      if (!res.ok) {
        console.error(payload);
        throw new Error((payload as any)?.error || "Failed to update seller phone.");
      }

      const updated = (payload as any).property;

      // Update local properties list
      setProperties((prev) =>
        prev.map((p) =>
          p.id === updated.id
            ? {
                ...p,
                sellerPhone:
                  updated.seller_phone ?? updated.sellerPhone ?? null,
              }
            : p
        )
      );

      // Update selected property
      setSelectedProperty((prev) =>
        prev && prev.id === updated.id
          ? {
              ...prev,
              sellerPhone:
                updated.seller_phone ?? updated.sellerPhone ?? null,
            }
          : prev
      );
    } catch (err: any) {
      console.error(err);
      setPhoneError(err.message ?? "Error saving phone.");
    } finally {
      setIsSavingPhone(false);
    }
  };

  // 🔹 Step 6: Text seller via /api/text-seller using propertyId
  const handleTextSellerFromDetail = async () => {
    if (!selectedProperty) return;

    setIsTextingSeller(true);
    setTextError(null);

    try {
      const res = await fetch("/api/text-seller", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: selectedProperty.id,
          userId: user?.id ?? null,
          address: selectedProperty.address,
          city: selectedProperty.city,
          state: selectedProperty.state,
          zip: selectedProperty.zip,
          price: selectedProperty.listPrice,
          to: selectedProperty.sellerPhone,
        }),
      });

      const payload = await res.json();

      if (!res.ok) {
        const msg = (payload as any)?.error || "Could not send SMS.";
        setTextError(msg);
        showToast("error", msg);
        return;
      }

      const usedSellerPhone =
        (payload as any)?.usedSellerPhone ??
        !!(sellerPhone || selectedProperty.sellerPhone);

      showToast(
        "success",
        usedSellerPhone
          ? "SMS sent to seller."
          : "SMS sent to test number (no seller phone set)."
      );
    } catch (err) {
      setTextError("Could not send SMS.");
      showToast("error", "Could not send SMS.");
    } finally {
      setIsTextingSeller(false);
    }
  };

  const handleCallSellerFromDetail = () => {
    const effective = normalizePhone(
      sellerPhone || selectedProperty?.sellerPhone || ""
    );
    if (!effective) {
      showToast("error", "No seller phone set for this property yet.");
      return;
    }
    window.location.href = `tel:${effective}`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getPropertyById = (id: string) =>
    properties.find((p) => p.id === id) || null;

  const effectiveDrawerPhone =
    sellerPhone || selectedProperty?.sellerPhone || "";
  const hasDrawerPhone = !!effectiveDrawerPhone;

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      {toast && (
        <div
          className={
            "fixed right-4 top-16 z-40 rounded-lg border px-3 py-2 text-xs shadow-xl md:right-8 " +
            (toast.type === "error"
              ? "border-red-500/50 bg-red-500/10 text-red-100"
              : "border-emerald-500/50 bg-emerald-500/10 text-emerald-100")
          }
        >
          {toast.message}
        </div>
      )}

      {/* Top Bar */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-600 text-xs font-semibold tracking-widest">
              DRX
            </div>
            <div>
              <div className="text-sm font-semibold tracking-widest uppercase">
                Dravex Leads
              </div>
              <div className="text-xs text-slate-400 -mt-0.5">
                Investor &amp; Wholesaler Toolkit
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-300">
            {user ? (
              <>
                <span className="hidden md:inline text-slate-400">
                  Signed in as{" "}
                  <span className="text-slate-100">
                    {user.email ?? user.id}
                  </span>
                </span>
                <button
                  onClick={handleSignOut}
                  className="rounded-full border border-slate-700 px-3 py-1 text-[11px] font-semibold hover:bg-slate-800/80"
                >
                  Sign out
                </button>
                <a
                  href="/automation/sequences"
                  className="rounded-full border border-slate-700 px-3 py-1 text-[11px] font-semibold hover:bg-slate-800/80"
                >
                  Automation
                </a>
              </>
            ) : (
              <span className="text-slate-400 text-[11px] md:text-xs">
                Sign in to save notes &amp; follow-ups
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row">
        {/* Filters */}
        <aside className="glass w-full rounded-2xl p-4 md:w-80 md:p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Filters
          </h2>

          <div className="space-y-4 text-sm">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Search
              </label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Address, city, zip…"
                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm outline-none ring-indigo-500/60 focus:ring"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Min Price
                </label>
                <input
                  value={minPrice === "" ? "" : minPrice}
                  onChange={handleNumberChange(setMinPrice)}
                  inputMode="numeric"
                  placeholder="150k"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm outline-none ring-indigo-500/60 focus:ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Max Price
                </label>
                <input
                  value={maxPrice === "" ? "" : maxPrice}
                  onChange={handleNumberChange(setMaxPrice)}
                  inputMode="numeric"
                  placeholder="600k"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm outline-none ring-indigo-500/60 focus:ring"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Max DOM
                </label>
                <input
                  value={maxDom === "" ? "" : maxDom}
                  onChange={handleNumberChange(setMaxDom)}
                  inputMode="numeric"
                  placeholder="60"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm outline-none ring-indigo-500/60 focus:ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Min Score
                </label>
                <input
                  value={minMotivation === "" ? "" : minMotivation}
                  onChange={handleNumberChange(setMinMotivation)}
                  inputMode="numeric"
                  placeholder="70"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm outline-none ring-indigo-500/60 focus:ring"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm outline-none ring-indigo-500/60 focus:ring"
              >
                <option value="All">All</option>
                <option value="Active">Active</option>
                <option value="Pending">Pending</option>
                <option value="Off Market">Off Market</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Lead Stage
              </label>
              <select
                value={leadStageFilter}
                onChange={(e) =>
                  setLeadStageFilter(
                    e.target.value as
                      | "All"
                      | "new"
                      | "contacted"
                      | "follow_up"
                      | "dead"
                  )
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm outline-none ring-indigo-500/60 focus:ring"
              >
                <option value="All">All</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="follow_up">Follow-up</option>
                <option value="dead">Dead</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setMinPrice("");
                setMaxPrice("");
                setMaxDom("");
                setMinMotivation("");
                setStatus("All");
                setLeadStageFilter("All");
              }}
              className="mt-2 w-full rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200 hover:bg-slate-800/80"
            >
              Reset filters
            </button>
          </div>
        </aside>

        {/* Right column: Auth + follow-ups + results */}
        <section className="flex-1 space-y-4">
          {/* Auth card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Account
              </h2>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <button
                  className={
                    "underline-offset-4 hover:underline " +
                    (authMode === "signIn" ? "text-indigo-300" : "")
                  }
                  onClick={() => setAuthMode("signIn")}
                >
                  Sign in
                </button>
                <span className="text-slate-600">·</span>
                <button
                  className={
                    "underline-offset-4 hover:underline " +
                    (authMode === "signUp" ? "text-indigo-300" : "")
                  }
                  onClick={() => setAuthMode("signUp")}
                >
                  Sign up
                </button>
              </div>
            </div>

            {user ? (
              <div className="text-xs text-slate-300">
                You&apos;re signed in as{" "}
                <span className="font-semibold">
                  {user.email ?? user.id}
                </span>
                . Notes and follow-ups are scoped to this account.
              </div>
            ) : (
              <form
                className="mt-2 space-y-2 text-xs"
                onSubmit={(e) => {
                  e.preventDefault();
                  authMode === "signIn" ? handleSignIn() : handleSignUp();
                }}
              >
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="md:col-span-1">
                    <label className="mb-1 block text-[11px] text-slate-400">
                      Email
                    </label>
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs outline-none ring-indigo-500/60 focus:ring"
                      required
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="mb-1 block text-[11px] text-slate-400">
                      Password
                    </label>
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs outline-none ring-indigo-500/60 focus:ring"
                      required
                    />
                  </div>
                </div>
                {authError && (
                  <div className="text-[11px] text-red-300">{authError}</div>
                )}
                {authInfo && (
                  <div className="text-[11px] text-emerald-300">
                    {authInfo}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={authLoading}
                  className="mt-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-slate-100 hover:bg-indigo-500 disabled:opacity-60"
                >
                  {authLoading
                    ? "Working…"
                    : authMode === "signIn"
                    ? "Sign in"
                    : "Create account"}
                </button>
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={handlePasswordReset}
                  className="ml-2 mt-1 rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-100 hover:bg-slate-800/80 disabled:opacity-60"
                >
                  Send reset link
                </button>
              </form>
            )}
          </div>

          {/* Saved Searches */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Saved Searches
              </h2>
              {savedSearchError && (
                <span className="text-[11px] text-red-300">
                  {savedSearchError}
                </span>
              )}
            </div>

            {!user ? (
              <div className="py-2 text-xs text-slate-500">
                Sign in to save and reuse your favorite filters.
              </div>
            ) : (
              <>
                <div className="mb-3 flex gap-2 text-xs">
                  <input
                    type="text"
                    placeholder="Name this search..."
                    value={newSearchName}
                    onChange={(e) => setNewSearchName(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-xs text-slate-100 outline-none ring-indigo-500/60 focus:ring"
                  />
                  <button
                    type="button"
                    onClick={handleSaveCurrentSearch}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-slate-100 hover:bg-indigo-500"
                  >
                    Save
                  </button>
                </div>

                {isLoadingSavedSearches ? (
                  <div className="py-1 text-xs text-slate-400">
                    Loading saved searches…
                  </div>
                ) : savedSearches.length === 0 ? (
                  <div className="py-1 text-xs text-slate-500">
                    No saved searches yet. Set your filters and save one.
                  </div>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {savedSearches.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-1.5"
                      >
                        <button
                          type="button"
                          className="flex-1 text-left text-slate-100 hover:underline"
                          onClick={() => handleApplySavedSearch(s)}
                        >
                          {s.name}
                        </button>
                        <button
                          type="button"
                          className="text-[11px] text-slate-500 hover:text-red-300"
                          onClick={() => handleDeleteSavedSearch(s.id)}
                        >
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          {/* Upcoming follow-ups */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Upcoming Follow-ups
              </h2>
              {followupsError && (
                <span className="text-[11px] text-red-300">{followupsError}</span>
              )}
            </div>

            {!user ? (
              <div className="py-2 text-xs text-slate-500">
                Sign in to view or add follow-ups.
              </div>
            ) : followupsLoading ? (
              <div className="py-2 text-xs text-slate-400">Loading follow-ups…</div>
            ) : followups.length === 0 ? (
              <div className="py-2 text-xs text-slate-500">
                No follow-ups yet. Use &ldquo;Add follow-up&rdquo; in a deal to create one.
              </div>
            ) : (
              <ul className="space-y-2 text-xs">
                {followups.map((f) => {
                  const prop = getPropertyById(f.propertyId);
                  return (
                    <li
                      key={f.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-slate-100">{f.title}</div>
                        {prop ? (
                          <div className="text-[11px] text-slate-400">
                            {prop.address} · {prop.city}, {prop.state} {prop.zip}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-500">
                            Property ID: {f.propertyId}
                          </div>
                        )}
                        {f.status === "completed" && f.completedAt && (
                          <div className="mt-1 text-[11px] text-emerald-300">
                            Completed {formatDate(f.completedAt)}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="text-[11px] text-slate-300">{formatDate(f.dueAt)}</div>
                        <div
                          className={
                            "text-[11px] uppercase tracking-[0.16em] " +
                            (f.status === "completed" ? "text-emerald-300" : "text-amber-300")
                          }
                        >
                          {(f.status || "pending").toUpperCase()}
                        </div>
                        {f.status !== "completed" && (
                          <button
                            className="mt-1 rounded-full border border-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-100 hover:bg-slate-800/80"
                            onClick={() => handleCompleteFollowup(f.id)}
                          >
                            Mark done
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Properties table */}
          {!isLoading && !error && (
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
              <div className="hidden border-b border-slate-800 bg-slate-900/80 px-4 py-2 text-xs text-slate-400 md:grid md:grid-cols-[1.4fr,0.9fr,0.8fr,0.6fr,0.6fr,0.6fr] md:gap-3">
                <span>Property</span>
                <span>Price / ARV</span>
                <span>Metrics</span>
                <span>DOM</span>
                <span>Score</span>
                <span className="text-right">Actions</span>
              </div>

              <div className="divide-y divide-slate-800">
                {filteredProperties.map((p) => {
                  const arvValue = p.arv ?? null;
                  const spread =
                    arvValue !== null ? arvValue - p.listPrice : null;
                  const spreadPct =
                    spread !== null && arvValue
                      ? (spread / arvValue) * 100
                      : null;

                  return (
                    <article
                      key={p.id}
                      className="cursor-pointer px-4 py-3 text-xs transition hover:bg-slate-800/60 md:grid md:grid-cols-[1.4fr,0.9fr,0.8fr,0.6fr,0.6fr,0.6fr] md:gap-3"
                      onClick={() => openDetail(p)}
                    >
                      {/* Property */}
                      <div className="mb-2 md:mb-0">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[10px] font-semibold text-slate-300">
                            {p.city[0]}
                          </span>
                          <div>
                            <div className="font-semibold text-slate-100">
                              {p.address}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {p.city}, {p.state} {p.zip}
                            </div>
                          </div>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">
                          {formatNumber(p.beds)} bd · {formatNumber(p.baths, 1)} ba ·{" "}
                          {formatNumber(p.sqft)} sqft
                        </div>
                      </div>

                      {/* Price / ARV */}
                      <div className="mb-2 md:mb-0">
                        <div className="font-semibold text-slate-100">
                          {formatMoney(p.listPrice)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          ARV est. {formatMoneyOptional(arvValue)}
                        </div>
                        <div className="text-[11px] text-emerald-300">
                          {spread !== null ? (
                            <>
                              Spread ~ {formatMoney(spread)}{" "}
                              {spreadPct !== null
                                ? `(${spreadPct.toFixed(1)}%)`
                                : ""}
                            </>
                          ) : (
                            <span className="text-slate-500">
                              Spread needs ARV
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Metrics */}
                      <div className="mb-2 md:mb-0 space-y-1 text-[11px] text-slate-400">
                        <div>
                          Status:{" "}
                          <span
                            className={
                              p.status === "Active"
                                ? "text-emerald-300"
                                : p.status === "Pending"
                                ? "text-amber-300"
                                : "text-slate-300"
                            }
                          >
                            {p.status}
                          </span>
                        </div>

                        <div>Motivation: {p.motivationScore}/100</div>

                        <div>DOM: {formatNumber(p.dom)}</div>

                        <div>
                          Stage:{" "}
                          <span
                            className={
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                              (p.leadStage === "new"
                                ? "bg-sky-500/10 text-sky-300 border border-sky-500/50"
                                : p.leadStage === "contacted"
                                ? "bg-amber-500/10 text-amber-300 border border-amber-500/50"
                                : p.leadStage === "follow_up"
                                ? "bg-violet-500/10 text-violet-300 border border-violet-500/50"
                                : "bg-slate-500/10 text-slate-300 border border-slate-500/50")
                            }
                          >
                            {p.leadStage === "follow_up"
                              ? "Follow-up"
                              : p.leadStage
                              ? p.leadStage
                                  .charAt(0)
                                  .toUpperCase() +
                                p.leadStage.slice(1).replace("_", " ")
                              : "New"}
                          </span>
                        </div>
                      </div>

                      {/* DOM (standalone col for desktop) */}
                      <div className="hidden items-center text-sm text-slate-200 md:flex">
                        {p.dom !== null && p.dom !== undefined
                          ? `${p.dom} days`
                          : "—"}
                      </div>

                      {/* Score */}
                      <div className="hidden md:flex md:flex-col md:justify-center">
                        <div className="text-sm font-semibold text-slate-100">
                          {p.motivationScore}
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800">
                          <div
                            className="h-1.5 rounded-full bg-emerald-400"
                            style={{ width: `${p.motivationScore}%` }}
                          />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="mt-2 flex items-center justify-end gap-2 md:mt-0">
                        <button
                          className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-100 hover:bg-slate-800/80"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (p.sellerPhone) {
                              window.location.href = `tel:${p.sellerPhone}`;
                            } else {
                              showToast(
                                "error",
                                "No seller phone on file for this property yet."
                              );
                            }
                          }}
                        >
                          Call
                        </button>

                        <button
                          className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-slate-100 hover:bg-indigo-500"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                            const res = await fetch("/api/text-seller", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify({
                                propertyId: p.id,
                                userId: user?.id ?? null,
                                address: p.address,
                                city: p.city,
                                state: p.state,
                                zip: p.zip,
                                price: p.listPrice,
                                to: p.sellerPhone,
                              }),
                            });

                              const payload = await res.json();

                              if (!res.ok) {
                                console.error(payload);
                                showToast(
                                  "error",
                                  (payload as any)?.error ||
                                    "Could not send SMS."
                                );
                                return;
                              }

                              const usedSellerPhone =
                                (payload as any)?.usedSellerPhone ?? !!p.sellerPhone;

                              showToast(
                                "success",
                                usedSellerPhone
                                  ? "SMS sent to seller."
                                  : "SMS sent to test number (no seller phone set)."
                              );
                            } catch (err) {
                              console.error(err);
                              showToast("error", "Could not send SMS.");
                            }
                          }}
                        >
                          Text
                        </button>
                      </div>
                    </article>
                  );
                })}

                {filteredProperties.length === 0 && (
                  <div className="px-4 py-6 text-center text-xs text-slate-400">
                    No properties match your filters yet. Loosen your criteria
                    or add more markets.
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Detail Panel */}
      {selectedProperty && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-30 bg-black/40"
            onClick={closeDetail}
          />

          {/* Drawer */}
          <aside className="fixed right-0 top-0 z-40 flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-slate-950/95 backdrop-blur">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Deal Detail
                </div>
                <div className="text-sm font-semibold text-slate-100">
                  {selectedProperty.address}
                </div>
                <div className="text-[11px] text-slate-400">
                  {selectedProperty.city}, {selectedProperty.state}{" "}
                  {selectedProperty.zip}
                </div>
              </div>
              <button
                onClick={closeDetail}
                className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800/80"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 text-sm">
              {/* Price / ARV / Spread */}
              <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Numbers
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-slate-400">List Price</div>
                    <div className="text-sm font-semibold text-slate-100">
                      {formatMoney(selectedProperty.listPrice)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Estimated ARV</div>
                    <div className="text-sm font-semibold text-slate-100">
                      {formatMoneyOptional(selectedProperty.arv)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Spread</div>
                    <div className="text-sm font-semibold text-emerald-300">
                      {selectedProperty.arv !== null &&
                      selectedProperty.arv !== undefined
                        ? formatMoney(
                            selectedProperty.arv - selectedProperty.listPrice
                          )
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">DOM</div>
                    <div className="text-sm font-semibold text-slate-100">
                      {selectedProperty.dom !== null &&
                      selectedProperty.dom !== undefined
                        ? `${selectedProperty.dom} days`
                        : "—"}
                    </div>
                  </div>
                </div>
              </section>

              {/* Status & Motivation */}
              <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Status &amp; Score
                  </div>
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold " +
                      (selectedProperty.status === "Active"
                        ? "border border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                        : selectedProperty.status === "Pending"
                        ? "border border-amber-500/60 bg-amber-500/10 text-amber-200"
                        : "border border-slate-500/60 bg-slate-500/10 text-slate-200")
                    }
                  >
                    {selectedProperty.status}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-slate-300">Lead Stage</span>
                  <select
                    value={selectedProperty.leadStage ?? "new"}
                    onChange={(e) =>
                      updateLeadStage(
                        selectedProperty.id,
                        e.target.value as
                          | "new"
                          | "contacted"
                          | "follow_up"
                          | "dead"
                      )
                    }
                    className="rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-100 outline-none focus:ring focus:ring-indigo-500/60"
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="follow_up">Follow-up</option>
                    <option value="dead">Dead</option>
                  </select>
                </div>

                <div className="mt-1 text-xs text-slate-400">
                  Motivation score is a rough signal of seller pain and deal
                  potential. Higher is better.
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">Motivation</span>
                    <span className="font-semibold text-slate-100">
                      {selectedProperty.motivationScore}/100
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-slate-800">
                    <div
                      className="h-2 rounded-full bg-emerald-400"
                      style={{
                        width: `${selectedProperty.motivationScore}%`,
                      }}
                    />
                  </div>
                </div>
              </section>

              {/* Property Facts */}
              <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Property Facts
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
                  <div>
                    <div className="text-slate-400">Beds</div>
                    <div className="text-sm font-semibold">
                      {formatNumber(selectedProperty.beds)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Baths</div>
                    <div className="text-sm font-semibold">
                      {formatNumber(selectedProperty.baths, 1)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Square Feet</div>
                    <div className="text-sm font-semibold">
                      {formatNumber(selectedProperty.sqft)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Zip Code</div>
                    <div className="text-sm font-semibold">
                      {selectedProperty.zip}
                    </div>
                  </div>
                </div>
              </section>

              {/* Seller Contact – only if phone exists */}
              {selectedProperty.sellerPhone && (
                <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Seller Contact
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-slate-300">
                    <div>
                      <div className="text-slate-400">Phone</div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <a
                          href={`tel:${selectedProperty.sellerPhone}`}
                          className="text-sm font-semibold text-emerald-300 hover:underline"
                        >
                          {selectedProperty.sellerPhone}
                        </a>
                        <button
                          type="button"
                          className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-slate-800/80"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(
                                selectedProperty.sellerPhone || ""
                              );
                              showToast(
                                "success",
                                "Seller phone copied to clipboard."
                              );
                            } catch {
                              showToast(
                                "error",
                                "Could not copy phone number."
                              );
                            }
                          }}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Use this number for direct calls or SMS campaigns. In
                      production, we can track call outcomes and responses here
                      too.
                    </p>
                  </div>
                </section>
              )}

              {/* SMS Activity */}
              <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    SMS Activity
                  </div>
                  {smsError && (
                    <span className="text-[11px] text-red-300">
                      {smsError}
                    </span>
                  )}
                </div>

                {!user ? (
                  <p className="text-xs text-slate-500">
                    Sign in to view SMS history for this deal.
                  </p>
                ) : smsLoading ? (
                  <p className="text-xs text-slate-400">
                    Loading messages…
                  </p>
                ) : smsMessages.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No SMS activity yet. Use the Text button to send the first
                    message.
                  </p>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {smsMessages.map((m) => (
                      <li
                        key={m.id}
                        className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-400">
                            {new Date(m.createdAt).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                          <span
                            className={
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " +
                              (m.source === "sequence"
                                ? "bg-purple-900/60 text-purple-200"
                                : "bg-slate-800 text-slate-200")
                            }
                          >
                            {m.source === "sequence" ? "Automated" : "Manual"}
                          </span>
                          <span
                            className={
                              "text-[10px] font-semibold uppercase tracking-[0.16em] " +
                              (m.status === "sent"
                                ? "text-emerald-300"
                                : "text-red-300")
                            }
                          >
                            {m.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">
                          To: <span className="text-slate-100">{m.toNumber}</span>
                        </div>
                        <div className="mt-1 whitespace-pre-wrap text-[11px] text-slate-100">
                          {m.body}
                        </div>
                        {m.status === "failed" && m.errorMessage && (
                          <div className="mt-1 text-[11px] text-red-300">
                            Error: {m.errorMessage}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* SMS Automation */}
              <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                {!user ? (
                  <p className="text-xs text-slate-500">
                    Sign in to enroll this lead in an automated SMS sequence.
                  </p>
                ) : smsAutomationLoading ? (
                  <p className="text-xs text-slate-400">Loading automation…</p>
                ) : (
                  <SmsAutomationSection
                    propertyId={selectedProperty.id}
                    sequences={smsSequences}
                    enrollment={smsEnrollment}
                    loading={smsAutomationLoading}
                    setLoading={setSmsAutomationLoading}
                    setErrorMsg={setSmsAutomationError}
                    onReload={loadSmsAutomation}
                  />
                )}
                {smsAutomationError && user && !smsAutomationLoading && (
                  <p className="mt-2 text-[11px] text-red-300">
                    {smsAutomationError}
                  </p>
                )}
              </section>

              {/* Notes */}
              <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Call Prep / Notes
                  </div>
                  {noteError && (
                    <span className="text-[11px] text-red-300">
                      {noteError}
                    </span>
                  )}
                </div>
                {!user ? (
                  <p className="text-xs text-slate-500">
                    Sign in to write and save notes for this deal.
                  </p>
                ) : (
                  <>
                    <p className="mb-2 text-xs text-slate-400">
                      These notes are stored in Supabase for your account and
                      this specific property.
                    </p>
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Ex: Tenant just moved out, needs some work, seller wants to be out in 30 days..."
                      className="h-24 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 outline-none ring-indigo-500/60 focus:ring"
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <button
                        className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-100 hover:bg-slate-800/80 disabled:opacity-60"
                        onClick={handleSaveNotes}
                        disabled={isSavingNote}
                      >
                        {isSavingNote ? "Saving…" : "Save notes"}
                      </button>
                      {feedbackMessage && (
                        <span className="text-[11px] text-slate-300">
                          {feedbackMessage}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </section>
            </div>

            <div className="border-t border-slate-800 px-4 py-3 flex items-center justify-between gap-3">
              <button
                className="flex-1 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800/80 disabled:opacity-60"
                onClick={handleAddFollowup}
                disabled={!user}
              >
                {user ? "Add follow-up" : "Sign in to add follow-up"}
              </button>
              <button
                className="flex-1 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-60"
                onClick={handleCallSellerFromDetail}
                disabled={!hasDrawerPhone}
              >
                Quick Call
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
