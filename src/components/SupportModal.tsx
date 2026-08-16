import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, User, Mail, Globe, HelpCircle, MessageSquare, Lightbulb, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { submitSupportInquiry, getFaqs } from "@/lib/console.functions";
import { useQuery } from "@tanstack/react-query";

export function SupportModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"chat" | "form">("chat");
  const [category, setCategory] = useState<"faq" | "inquiry" | "suggestion" | "complaint">("inquiry");
  
  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    website: "",
    message: ""
  });

  const submitInquiry = useServerFn(submitSupportInquiry);
  const fetchFaqs = useServerFn(getFaqs);
  const { data: faqs } = useQuery({ queryKey: ["public-faqs"], queryFn: () => fetchFaqs() });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await submitInquiry({ data: { ...formData, category } });
      toast.success("আপনার বার্তাটি অ্যাডমিনের কাছে পাঠানো হয়েছে।");
      setIsOpen(false);
      setStep("chat");
      setFormData({ name: "", contact: "", website: "", message: "" });
    } catch (err) {
      toast.error("বার্তা পাঠানো যায়নি।");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 size-14 rounded-full bg-primary text-primary-foreground shadow-2xl shadow-primary/40 flex items-center justify-center hover:scale-110 transition-all z-[100]"
      >
        <MessageCircle className="size-6" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-24 right-6 w-[90vw] max-w-[400px] glass rounded-[2.5rem] shadow-2xl border-white/10 z-[100] overflow-hidden"
          >
            <div className="p-6 bg-primary/10 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary flex items-center justify-center">
                  <MessageCircle className="size-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Daddy AI Support</h3>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Always Online</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6 max-h-[500px] overflow-y-auto custom-scrollbar">
              {step === "chat" ? (
                <div className="space-y-6">
                  <div className="bg-muted/40 p-4 rounded-2xl rounded-bl-none text-sm leading-relaxed">
                    হ্যালো! আমি Daddy AI সাপোর্ট। আপনাকে কীভাবে সাহায্য করতে পারি?
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <button 
                      onClick={() => setStep("form")} 
                      className="flex items-center gap-3 p-4 rounded-xl bg-card border border-white/5 hover:bg-primary/5 hover:border-primary/20 transition-all text-left group"
                    >
                      <HelpCircle className="size-5 text-primary group-hover:scale-110 transition-transform" />
                      <div>
                        <p className="text-sm font-bold">সাধারণ জিজ্ঞাসা (FAQ)</p>
                        <p className="text-[10px] text-muted-foreground">সচরাচর জিজ্ঞাসিত প্রশ্ন ও উত্তর</p>
                      </div>
                    </button>
                    
                    <button 
                      onClick={() => { setCategory("inquiry"); setStep("form"); }}
                      className="flex items-center gap-3 p-4 rounded-xl bg-card border border-white/5 hover:bg-primary/5 hover:border-primary/20 transition-all text-left group"
                    >
                      <MessageSquare className="size-5 text-accent group-hover:scale-110 transition-transform" />
                      <div>
                        <p className="text-sm font-bold">নতুন ইনকোয়ারি</p>
                        <p className="text-[10px] text-muted-foreground">আমাদের সার্ভিস সম্পর্কে জানতে</p>
                      </div>
                    </button>

                    <button 
                      onClick={() => { setCategory("suggestion"); setStep("form"); }}
                      className="flex items-center gap-3 p-4 rounded-xl bg-card border border-white/5 hover:bg-primary/5 hover:border-primary/20 transition-all text-left group"
                    >
                      <Lightbulb className="size-5 text-success group-hover:scale-110 transition-transform" />
                      <div>
                        <p className="text-sm font-bold">পরামর্শ (Suggestion)</p>
                        <p className="text-[10px] text-muted-foreground">আমাদের আরও উন্নত করতে আপনার মতামত</p>
                      </div>
                    </button>

                    <button 
                      onClick={() => { setCategory("complaint"); setStep("form"); }}
                      className="flex items-center gap-3 p-4 rounded-xl bg-card border border-white/5 hover:bg-primary/5 hover:border-primary/20 transition-all text-left group"
                    >
                      <AlertCircle className="size-5 text-destructive group-hover:scale-110 transition-transform" />
                      <div>
                        <p className="text-sm font-bold">অভিযোগ (Complaint)</p>
                        <p className="text-[10px] text-muted-foreground">কোনো সমস্যায় পড়েছেন?</p>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex items-center gap-2 mb-2 text-primary font-bold text-sm">
                    <button type="button" onClick={() => setStep("chat")} className="hover:underline flex items-center gap-1">
                      ← পিছে যান
                    </button>
                    <span className="text-muted-foreground/30">|</span>
                    <span className="uppercase tracking-widest text-[10px]">{category}</span>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">নাম</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                      <Input 
                        required 
                        className="pl-9 bg-muted/20" 
                        placeholder="আপনার নাম"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">ইমেইল বা ফোন নম্বর</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                      <Input 
                        required 
                        className="pl-9 bg-muted/20" 
                        placeholder="আপনার সাথে যোগাযোগের মাধ্যম"
                        value={formData.contact}
                        onChange={(e) => setFormData({...formData, contact: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">ব্যবসার পেজ বা ওয়েবসাইট (যদি থাকে)</Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                      <Input 
                        className="pl-9 bg-muted/20" 
                        placeholder="https://..."
                        value={formData.website}
                        onChange={(e) => setFormData({...formData, website: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">আপনার বার্তা</Label>
                    <Textarea 
                      required 
                      className="bg-muted/20" 
                      placeholder="এখানে বিস্তারিত লিখুন..."
                      rows={4}
                      value={formData.message}
                      onChange={(e) => setFormData({...formData, message: e.target.value})}
                    />
                  </div>

                  <Button type="submit" className="w-full rounded-xl" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
                    বার্তা পাঠান
                  </Button>
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
