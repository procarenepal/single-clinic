import { useState, useEffect } from "react";
import { 
  IoArrowBackOutline, 
  IoSaveOutline, 
  IoImageOutline,
  IoEyeOutline,
  IoInformationCircleOutline
} from "react-icons/io5";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

import { title, subtitle } from "@/components/primitives";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Divider } from "@/components/ui/divider";
import { Spinner } from "@/components/ui/spinner";
import { useAuthContext } from "@/context/AuthContext";
import { addToast } from "@/components/ui/toast";
import { landingPageService, LandingPageContent } from "@/services/landingPageService";

export default function HomepageSettingsPage() {
  const { clinicId } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState<LandingPageContent | null>(null);

  useEffect(() => {
    const loadContent = async () => {
      if (!clinicId) return;
      try {
        const data = await landingPageService.getHomepageContent(clinicId);
        setContent(data);
      } catch (error) {
        addToast({
          title: "Error",
          description: "Failed to load homepage content",
          color: "danger",
        });
      } finally {
        setLoading(false);
      }
    };
    loadContent();
  }, [clinicId]);

  const handleSave = async () => {
    if (!clinicId || !content) return;
    setSaving(true);
    try {
      await landingPageService.updateHomepageContent(clinicId, content);
      addToast({
        title: "Success",
        description: "Homepage content updated successfully",
        color: "success",
      });
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to save content",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!content) return null;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto py-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className={title({ size: "lg" })}>Homepage Management</h1>
          <p className={subtitle({ class: "mt-1" })}>
            Customize how your Korean skincare clinic appears to the public
          </p>
        </div>

        <div className="flex gap-3">
          <Link to="/dashboard/settings">
            <Button startContent={<IoArrowBackOutline />} variant="light">
              Back
            </Button>
          </Link>
          <Button 
            color="primary" 
            isLoading={saving}
            onClick={handleSave}
            startContent={<IoSaveOutline />}
          >
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Hero Section */}
        <Card>
          <CardHeader className="flex gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <IoImageOutline size={20} />
            </div>
            <div className="flex flex-col">
              <p className="text-md font-bold">Hero Section</p>
              <p className="text-small text-default-500">The first thing clients see</p>
            </div>
          </CardHeader>
          <Divider />
          <CardBody className="gap-4 py-6">
            <Input
              label="Main Title"
              placeholder="e.g. Radiant Skin, Timeless Korean Beauty"
              value={content.hero.title}
              onChange={(e) => setContent({
                ...content,
                hero: { ...content.hero, title: e.target.value }
              })}
            />
            <Textarea
              label="Subtitle / Description"
              placeholder="Briefly describe your skincare clinic..."
              value={content.hero.subtitle}
              onChange={(e) => setContent({
                ...content,
                hero: { ...content.hero, subtitle: e.target.value }
              })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="CTA Button Text"
                value={content.hero.ctaText}
                onChange={(e) => setContent({
                  ...content,
                  hero: { ...content.hero, ctaText: e.target.value }
                })}
              />
              <Input
                label="CTA Link"
                value={content.hero.ctaLink}
                onChange={(e) => setContent({
                  ...content,
                  hero: { ...content.hero, ctaLink: e.target.value }
                })}
              />
            </div>
            <Input
              label="Hero Image URL"
              value={content.hero.imageUrl}
              onChange={(e) => setContent({
                ...content,
                hero: { ...content.hero, imageUrl: e.target.value }
              })}
            />
          </CardBody>
        </Card>

        {/* Stats Section */}
        <Card>
          <CardHeader className="flex gap-3">
            <div className="p-2 bg-green-50 text-green-600 rounded-lg">
              <IoInformationCircleOutline size={20} />
            </div>
            <div className="flex flex-col">
              <p className="text-md font-bold">Trust Indicators (Stats)</p>
              <p className="text-small text-default-500">Key achievements of your clinic</p>
            </div>
          </CardHeader>
          <Divider />
          <CardBody className="gap-6 py-6">
            {content.stats.map((stat, index) => (
              <div key={index} className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <Input
                  label={`Stat ${index + 1} Number`}
                  value={stat.number}
                  onChange={(e) => {
                    const newStats = [...content.stats];
                    newStats[index].number = e.target.value;
                    setContent({ ...content, stats: newStats });
                  }}
                />
                <Input
                  label={`Stat ${index + 1} Label`}
                  value={stat.label}
                  onChange={(e) => {
                    const newStats = [...content.stats];
                    newStats[index].label = e.target.value;
                    setContent({ ...content, stats: newStats });
                  }}
                />
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Precision Section */}
        <Card>
          <CardHeader className="flex gap-3">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Sparkles size={20} />
            </div>
            <div className="flex flex-col">
              <p className="text-md font-bold">Aesthetic Precision Section</p>
              <p className="text-small text-default-500">Highlight your technology and expertise</p>
            </div>
          </CardHeader>
          <Divider />
          <CardBody className="gap-4 py-6">
            <Input
              label="Section Title"
              value={content.precisionSection.title}
              onChange={(e) => setContent({
                ...content,
                precisionSection: { ...content.precisionSection, title: e.target.value }
              })}
            />
            <Textarea
              label="Section Description"
              value={content.precisionSection.description}
              onChange={(e) => setContent({
                ...content,
                precisionSection: { ...content.precisionSection, description: e.target.value }
              })}
            />
            <Input
              label="Section Image URL"
              value={content.precisionSection.imageUrl}
              onChange={(e) => setContent({
                ...content,
                precisionSection: { ...content.precisionSection, imageUrl: e.target.value }
              })}
            />
          </CardBody>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader className="flex gap-3">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <IoEyeOutline size={20} />
            </div>
            <div className="flex flex-col">
              <p className="text-md font-bold">Contact & Footer</p>
              <p className="text-small text-default-500">How clients can find you</p>
            </div>
          </CardHeader>
          <Divider />
          <CardBody className="gap-4 py-6">
            <Input
              label="Clinic Location"
              value={content.contact.location}
              onChange={(e) => setContent({
                ...content,
                contact: { ...content.contact, location: e.target.value }
              })}
            />
            <Input
              label="Opening Hours"
              value={content.contact.hours}
              onChange={(e) => setContent({
                ...content,
                contact: { ...content.contact, hours: e.target.value }
              })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Phone Number"
                value={content.contact.phone}
                onChange={(e) => setContent({
                  ...content,
                  contact: { ...content.contact, phone: e.target.value }
                })}
              />
              <Input
                label="Email Address"
                value={content.contact.email}
                onChange={(e) => setContent({
                  ...content,
                  contact: { ...content.contact, email: e.target.value }
                })}
              />
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
