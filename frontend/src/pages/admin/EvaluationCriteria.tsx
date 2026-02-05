import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useState, useEffect } from 'react';
import { RotateCcw, Save, Info } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface EvaluationCriteria {
  technical_skill: number;
  psychometric_assessment: number;
  soft_skill: number;
  fairplay: number;
  is_default: boolean;
}

export default function EvaluationCriteria() {
  const [criteria, setCriteria] = useState<EvaluationCriteria>({
    technical_skill: 37.5,
    psychometric_assessment: 25,
    soft_skill: 25,
    fairplay: 12.5,
    is_default: true
  });
  const [loading, setLoading] = useState(false);
  const [lockedFields, setLockedFields] = useState<Set<keyof EvaluationCriteria>>(new Set());
  const { toast } = useToast();

  // Fetch evaluation criteria on component mount
  useEffect(() => {
    fetchEvaluationCriteria();
  }, []);

  const fetchEvaluationCriteria = async () => {
    try {
      const token = localStorage.getItem('recruiter_token');
      const response = await fetch('http://localhost:5000/recruiter-dashboard/evaluation-criteria', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.criteria) {
          setCriteria({
            technical_skill: data.criteria.technical_skill,
            psychometric_assessment: data.criteria.psychometric_assessment,
            soft_skill: data.criteria.soft_skill,
            fairplay: data.criteria.fairplay,
            is_default: data.criteria.is_default
          });
          setLockedFields(new Set()); // Reset all locks when loading
        }
      }
    } catch (error) {
      console.error('Error fetching evaluation criteria:', error);
    }
  };

  const handleCriteriaChange = (field: keyof EvaluationCriteria, value: string) => {
    // Allow empty string for user to clear and retype
    if (value === '') {
      setCriteria(prev => ({
        ...prev,
        [field]: 0,
        is_default: false
      }));
      return;
    }

    const numValue = Math.max(0, Math.min(100, parseFloat(value)));
    
    // If invalid number, don't update
    if (isNaN(numValue)) {
      return;
    }
    
    // Mark this field as locked (it's been edited)
    setLockedFields(prev => new Set(prev).add(field));
    
    setCriteria(prev => {
      // Get current values
      const current = {
        technical_skill: prev.technical_skill,
        psychometric_assessment: prev.psychometric_assessment,
        soft_skill: prev.soft_skill,
        fairplay: prev.fairplay
      };
      
      // Calculate the difference
      const oldValue = current[field];
      const difference = numValue - oldValue;
      
      // If no significant change, just update the field
      if (Math.abs(difference) < 0.01) {
        return { ...prev, [field]: numValue, is_default: false };
      }
      
      // Get fields to adjust: exclude current field AND all locked fields
      const fieldsToAdjust = (['technical_skill', 'psychometric_assessment', 'soft_skill', 'fairplay'] as const)
        .filter(f => f !== field && !lockedFields.has(f));
      
      // If no fields to adjust, we can't maintain 100%, so unlock all except current
      if (fieldsToAdjust.length === 0) {
        setLockedFields(new Set([field]));
        // Recalculate with all other fields adjustable
        const otherFields = (['technical_skill', 'psychometric_assessment', 'soft_skill', 'fairplay'] as const)
          .filter(f => f !== field);
        const otherSum = otherFields.reduce((sum, f) => sum + current[f], 0);
        const newValues = { ...current, [field]: numValue };
        
        if (otherSum > 0) {
          otherFields.forEach(f => {
            const proportion = current[f] / otherSum;
            const adjustment = difference * proportion;
            newValues[f] = parseFloat(Math.max(0, Math.min(100, current[f] - adjustment)).toFixed(2));
          });
        }
        
        return { ...newValues, is_default: false };
      }
      
      // Calculate sum of fields that will be adjusted
      const adjustableSum = fieldsToAdjust.reduce((sum, f) => sum + current[f], 0);
      
      // Start with current field updated
      const newValues = { ...current, [field]: numValue };
      
      if (adjustableSum > 0) {
        // Distribute the difference proportionally among adjustable fields only
        fieldsToAdjust.forEach(f => {
          const proportion = current[f] / adjustableSum;
          const adjustment = difference * proportion;
          newValues[f] = parseFloat(Math.max(0, Math.min(100, current[f] - adjustment)).toFixed(2));
        });
        
        // Ensure total is exactly 100 by adjusting the largest adjustable field
        const total = Object.values(newValues).reduce((sum, val) => sum + val, 0);
        if (Math.abs(total - 100) > 0.01 && fieldsToAdjust.length > 0) {
          const largestAdjustableField = fieldsToAdjust.reduce((max, f) => 
            newValues[f] > newValues[max] ? f : max
          , fieldsToAdjust[0]);
          newValues[largestAdjustableField] = parseFloat(Math.max(0, newValues[largestAdjustableField] + (100 - total)).toFixed(2));
        }
      } else {
        // If adjustable sum is 0, split the difference equally among adjustable fields
        const lockedSum = Array.from(lockedFields).reduce((sum, f) => sum + current[f], 0);
        const splitAmount = parseFloat(((100 - numValue - lockedSum) / fieldsToAdjust.length).toFixed(2));
        fieldsToAdjust.forEach(f => {
          newValues[f] = splitAmount;
        });
      }
      
      return {
        ...newValues,
        is_default: false
      };
    });
  };

  const getTotalPercentage = () => {
    const total = criteria.technical_skill + criteria.psychometric_assessment + 
           criteria.soft_skill + criteria.fairplay;
    return parseFloat(total.toFixed(2));
  };

  const handleSaveCriteria = async () => {
    const total = getTotalPercentage();
    
    // This should rarely happen due to auto-adjustment, but check anyway
    if (Math.abs(total - 100) > 0.01) {
      toast({
        title: "Invalid Percentages",
        description: `Total must equal 100%. Current total: ${total.toFixed(1)}%`,
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('recruiter_token');
      const response = await fetch('http://localhost:5000/recruiter-dashboard/evaluation-criteria', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          technical_skill: parseFloat(criteria.technical_skill.toFixed(2)),
          psychometric_assessment: parseFloat(criteria.psychometric_assessment.toFixed(2)),
          soft_skill: parseFloat(criteria.soft_skill.toFixed(2)),
          fairplay: parseFloat(criteria.fairplay.toFixed(2))
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        toast({
          title: "Success",
          description: data.message || "Evaluation criteria updated successfully"
        });
        fetchEvaluationCriteria();
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to update evaluation criteria",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while saving",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetToDefaults = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('recruiter_token');
      const response = await fetch('http://localhost:5000/recruiter-dashboard/evaluation-criteria/reset', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        toast({
          title: "Success",
          description: "Evaluation criteria reset to recommended defaults"
        });
        fetchEvaluationCriteria();
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to reset evaluation criteria",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while resetting",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Evaluation Criteria</h1>
          <p className="text-muted-foreground mt-2">
            Configure weightage for different assessment parameters to evaluate candidates.
          </p>
        </div>
        {criteria.is_default && (
          <span className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-md border border-blue-500/20">
            Using Default Values
          </span>
        )}
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>How it works</AlertTitle>
        <AlertDescription>
          Set the weightage for each assessment parameter. When you adjust one percentage, the others 
          automatically adjust proportionally to maintain a total of 100%.
        </AlertDescription>
      </Alert>

      {/* Evaluation Matrix Card */}
      <Card className="p-6">
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Evaluation Matrix</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Adjust any parameter - others will automatically redistribute to keep the total at 100%.
            </p>
          </div>

          <Separator />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Parameter</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right w-[150px]">Weightage (%)</TableHead>
                <TableHead className="text-right w-[150px]">Recommended</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Technical Skill</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  MCQ and coding assessment scores
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={criteria.technical_skill}
                    onChange={(e) => handleCriteriaChange('technical_skill', e.target.value)}
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) {
                        handleCriteriaChange('technical_skill', val.toFixed(2));
                      }
                    }}
                    className="w-24 text-right ml-auto"
                  />
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">37.5%</TableCell>
              </TableRow>
              
              <TableRow>
                <TableCell className="font-medium">Psychometric Assessment</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  Personality and behavioral traits
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={criteria.psychometric_assessment}
                    onChange={(e) => handleCriteriaChange('psychometric_assessment', e.target.value)}
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) {
                        handleCriteriaChange('psychometric_assessment', val.toFixed(2));
                      }
                    }}
                    className="w-24 text-right ml-auto"
                  />
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">25%</TableCell>
              </TableRow>
              
              <TableRow>
                <TableCell className="font-medium">Soft Skills</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  Text-based answers and communication
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={criteria.soft_skill}
                    onChange={(e) => handleCriteriaChange('soft_skill', e.target.value)}                    onBlur={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) {
                        handleCriteriaChange('soft_skill', val.toFixed(2));
                      }
                    }}                    className="w-24 text-right ml-auto"
                  />
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">25%</TableCell>
              </TableRow>
              
              <TableRow>
                <TableCell className="font-medium">Fairplay</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  Proctoring violations and integrity
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={criteria.fairplay}
                    onChange={(e) => handleCriteriaChange('fairplay', e.target.value)}
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) {
                        handleCriteriaChange('fairplay', val.toFixed(2));
                      }
                    }}
                    className="w-24 text-right ml-auto"
                  />
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">12.5%</TableCell>
              </TableRow>
              
              <TableRow className="font-semibold border-t-2">
                <TableCell colSpan={2} className="text-base">Total</TableCell>
                <TableCell className="text-right">
                  <span className={
                    Math.abs(getTotalPercentage() - 100) < 0.01
                      ? 'text-green-600 dark:text-green-400 text-lg font-bold' 
                      : 'text-red-600 dark:text-red-400 text-lg font-bold'
                  }>
                    {getTotalPercentage().toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">100%</TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={handleResetToDefaults}
              disabled={loading}
              size="lg"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset to Defaults
            </Button>
            <Button 
              onClick={handleSaveCriteria}
              disabled={loading || Math.abs(getTotalPercentage() - 100) > 0.01}
              size="lg"
            >
              <Save className="mr-2 h-4 w-4" />
              {loading ? 'Saving...' : 'Save Criteria'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Guidelines Card */}
      <Card className="p-6 bg-muted/50">
        <h3 className="font-semibold mb-3">Guidelines</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• <strong>Technical Skill:</strong> Focus on candidates' technical competence - increase for senior technical roles</li>
          <li>• <strong>Psychometric Assessment:</strong> Emphasize personality fit - increase for leadership or team-oriented roles</li>
          <li>• <strong>Soft Skills:</strong> Prioritize communication and collaboration - increase for client-facing positions</li>
          <li>• <strong>Fairplay:</strong> Ensure integrity and honesty - increase for security-sensitive or compliance roles</li>
        </ul>
      </Card>
    </div>
  );
}
